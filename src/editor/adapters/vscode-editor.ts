import * as vscode from "vscode";

import { getIgnoredFolders } from "../../vscode-configuration";
import {
  Editor,
  Code,
  Modification,
  Command,
  ErrorReason,
  errorReasonToString,
  Choice,
  Result
} from "../editor";
import { Selection } from "../selection";
import { Position } from "../position";
import { AbsolutePath, Path } from "../path";
import { CodeReference } from "../code-reference";
import { SelectedPosition } from "../editor";

export class VSCodeEditor implements Editor {
  private editor: vscode.TextEditor;
  private document: vscode.TextDocument;
  public static panel: vscode.WebviewPanel | null = null;

  constructor(editor: vscode.TextEditor) {
    this.editor = editor;
    this.document = editor.document;
  }

  async workspaceFiles(): Promise<Path[]> {
    const uris = await this.findFileUris();

    return uris
      .map((uri) => new AbsolutePath(uri.path))
      .filter((path) => !path.equals(this.document.uri.path))
      .filter((path) => !path.fileName.endsWith(".d.ts"))
      .map((path) => path.relativeTo(this.document.uri.path));
  }

  protected async findFileUris(): Promise<vscode.Uri[]> {
    const ignoredFoldersGlobPattern = `{${getIgnoredFolders().join(",")}}`;
    return vscode.workspace.findFiles(
      "**/*.{js,jsx,ts,tsx}",
      `**/${ignoredFoldersGlobPattern}/**`
    );
  }

  get code(): Code {
    return this.document.getText();
  }

  async codeOf(path: Path): Promise<Code> {
    const fileUri = this.fileUriAt(path);
    // Get file content even if user does not save last changes
    const doc = await vscode.workspace.openTextDocument(fileUri);

    return doc.getText();
  }

  get selection(): Selection {
    return createSelectionFromVSCode(this.editor.selection);
  }

  async write(code: Code, newCursorPosition?: Position): Promise<void> {
    // We need to register initial position BEFORE we update the document.
    const cursorAtInitialStartPosition = new vscode.Selection(
      this.editor.selection.start,
      this.editor.selection.start
    );

    const edit = new vscode.WorkspaceEdit();
    edit.set(this.document.uri, [new vscode.TextEdit(this.editRange, code)]);
    await vscode.workspace.applyEdit(edit);

    // Put cursor at correct position
    this.editor.selection = newCursorPosition
      ? toVSCodeCursor(newCursorPosition)
      : cursorAtInitialStartPosition;

    // Scroll to correct position if it changed
    if (newCursorPosition) {
      const position = toVSCodePosition(newCursorPosition);
      this.editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.Default
      );
    }
  }

  async writeIn(path: Path, code: Code): Promise<void> {
    const fileUri = this.fileUriAt(path);
    await VSCodeEditor.ensureFileExists(fileUri);

    const edit = new vscode.WorkspaceEdit();
    const WHOLE_DOCUMENT = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(Number.MAX_SAFE_INTEGER, 0)
    );
    edit.set(fileUri, [new vscode.TextEdit(WHOLE_DOCUMENT, code)]);
    await vscode.workspace.applyEdit(edit);

    const updatedDocument = await vscode.workspace.openTextDocument(fileUri);
    await updatedDocument.save();
  }

  static async ensureFileExists(fileUri: vscode.Uri) {
    try {
      await vscode.workspace.fs.readFile(fileUri);
    } catch {
      // If file doesn't exist, reading it will throw.
      // We assume that's the only reason it would throw here.
      const NO_CONTENT = new Uint8Array();
      await vscode.workspace.fs.writeFile(fileUri, NO_CONTENT);
    }
  }

  protected fileUriAt(path: Path): vscode.Uri {
    const filePath = path.absoluteFrom(this.document.uri.path);

    return this.document.uri.with({ path: filePath.value });
  }

  protected get editRange(): vscode.Range {
    return new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(this.document.lineCount, 0)
    );
  }

  async readThenWrite(
    selection: Selection,
    getModifications: (code: Code) => Modification[],
    newCursorPosition?: Position
  ): Promise<void> {
    const startPosition = toVSCodePosition(selection.start);
    const endPosition = toVSCodePosition(selection.end);

    const readCode = this.document.getText(
      new vscode.Range(startPosition, endPosition)
    );

    const textEdits = getModifications(readCode).map(({ code, selection }) => {
      const startPosition = toVSCodePosition(selection.start);
      const endPosition = toVSCodePosition(selection.end);

      return new vscode.TextEdit(
        new vscode.Range(startPosition, endPosition),
        code
      );
    });

    const edit = new vscode.WorkspaceEdit();
    edit.set(this.document.uri, textEdits);

    await vscode.workspace.applyEdit(edit);

    if (newCursorPosition) {
      this.editor.selection = toVSCodeCursor(newCursorPosition);
    }
  }

  async delegate(command: Command) {
    await vscode.commands.executeCommand(toVSCodeCommand(command));
    return Result.OK;
  }

  async showError(reason: ErrorReason) {
    await vscode.window.showErrorMessage(errorReasonToString(reason));
  }

  async askUserChoice<T>(choices: Choice<T>[], placeHolder?: string) {
    return await vscode.window.showQuickPick(
      choices.map(({ label, value, description, icon }) => ({
        label: icon ? `$(${icon}) ${label}` : label,
        value,
        description
      })),
      { placeHolder, matchOnDescription: true }
    );
  }

  async askUserInput(defaultValue?: string) {
    return await vscode.window.showInputBox({ value: defaultValue });
  }

  moveCursorTo(position: Position) {
    this.editor.selection = toVSCodeCursor(position);
    return Promise.resolve();
  }

  async getSelectionReferences(selection: Selection): Promise<CodeReference[]> {
    const locations = (await vscode.commands.executeCommand(
      "vscode.executeReferenceProvider",
      this.document.uri,
      selection.start
    )) as vscode.Location[];

    return locations.map((loc) => {
      const start = loc.range.start;
      const end = loc.range.end;

      const path = new AbsolutePath(loc.uri.path);

      const codeReferenceSelection = new Selection(
        [start.line + 1, start.character],
        [end.line + 1, end.character]
      );

      return new CodeReference(path, codeReferenceSelection);
    });
  }

  async askForPositions(
    params: SelectedPosition[],
    onConfirm: (positions: SelectedPosition[]) => Promise<void>
  ): Promise<void> {
    if (VSCodeEditor.panel !== null) {
      VSCodeEditor.panel.dispose();
    }

    VSCodeEditor.panel = vscode.window.createWebviewPanel(
      "changeSignature",
      "Change function signature",
      vscode.ViewColumn.Beside,
      {}
    );

    VSCodeEditor.panel.webview.options = {
      enableScripts: true
    };
    VSCodeEditor.panel.webview.html = getParamsPositionWebViewContent(
      params,
      VSCodeEditor.panel.webview
    );

    VSCodeEditor.panel.webview.onDidReceiveMessage(
      async (message: Record<string, string>) => {
        const values = JSON.parse(message.values) as {
          label: string;
          startAt: number;
          endAt: number;
        }[];

        const result: SelectedPosition[] = values.map((result) => {
          return {
            label: result.label,
            value: {
              startAt: result.startAt,
              endAt: result.endAt
            }
          };
        });

        await onConfirm(result);
        VSCodeEditor.panel?.dispose();
        VSCodeEditor.panel = null;
      },
      undefined
    );

    VSCodeEditor.panel.onDidDispose(() => {
      VSCodeEditor.panel = null;
    });
  }
}

function createSelectionFromVSCode(
  selection: vscode.Selection | vscode.Range
): Selection {
  return new Selection(
    [selection.start.line, selection.start.character],
    [selection.end.line, selection.end.character]
  );
}

function toVSCodeCursor(position: Position): vscode.Selection {
  return new vscode.Selection(
    toVSCodePosition(position),
    toVSCodePosition(position)
  );
}

function toVSCodePosition(position: Position): vscode.Position {
  return new vscode.Position(position.line, position.character);
}

function toVSCodeCommand(command: Command): string {
  switch (command) {
    case Command.RenameSymbol:
      return "editor.action.rename";

    default:
      return "";
  }
}

function getParamsPositionWebViewContent(
  params: SelectedPosition[],
  _webview: vscode.Webview
): string {
  const paramsTrValues = params.map((param) => {
    const name = param.label;
    return `
      <tr>
          <td class="params-name">${name}</td>
          <td>
            <span class="up"></span>
            <span class="down"></span>
          </td>
        </tr>
    `;
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <style>
      table {
        font-family: arial, sans-serif;
        border-collapse: collapse;
      }

      td,
      th {
        border: 1px solid #dddddd;
        text-align: left;
        padding: 8px;
      }

      th:last-child {
        border-top-color: transparent;
        border-right-color: transparent;
      }

      .up,
      .down {
        cursor: pointer;
        display: inline-block;
        width: 8px;
        margin: 0 0.7rem;
        font-size: 1.2rem;
      }

      .up:after {
        content: "▲";
      }

      .up:hover:after {
        color: #625e5e;
      }

      .down:after {
        content: "▼";
      }

      .down:hover:after {
        color: #625e5e;
      }

      button {
        border: 1px solid transparent;
        border-radius: 5px;
        line-height: 1.25rem;
        outline: none;
        text-align: center;
        white-space: nowrap;
        display: inline-block;
        text-decoration: none;
        background: #1a85ff;
        padding: 4px;
        color: white;
        font-size: 14px;
      }

      button:hover {
        cursor: pointer;
        color: white;
      }
    </style>
  </head>

  <body>
    <h4>Parameters</h4>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th></th>
        </tr>
      </thead>

      <tbody id="params">
        ${paramsTrValues.join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="text-align: center">
            <button id="confirm">Confirm</button>
          </td>
        </tr>
      </tfoot>
    </table>

    <div class="btn-wrapper"></div>

    <script>
      const vscode = acquireVsCodeApi();
      const startValues = document.querySelectorAll("#params .params-name");
      function moveUp(element) {
        if (element.previousElementSibling)
          element.parentNode.insertBefore(
            element,
            element.previousElementSibling
          );
      }

      function moveDown(element) {
        if (element.nextElementSibling)
          element.parentNode.insertBefore(element.nextElementSibling, element);
      }

      document.querySelector("#params").addEventListener("click", function (e) {
        if (e.target.className === "down")
          moveDown(e.target.parentNode.parentNode);
        else if (e.target.className === "up")
          moveUp(e.target.parentNode.parentNode);
      });

      document.querySelector("#confirm").addEventListener("click", () => {
        const tdsElements = document.querySelectorAll("#params .params-name");
        const tds = Array.from(tdsElements);

        const items = Array.from(startValues).map((item, index) => {
          const endAt = tds.findIndex((td) => td === item);

          return {
            label: item.innerHTML,
            startAt: index,
            endAt: endAt
          };
        });

        vscode.postMessage({
          values: JSON.stringify(items)
        });
      });
    </script>
  </body>
</html>
  `;
  return html;
}
