import * as t from "../../ast";
import { isFunctionDeclarationOrArrowFunction } from "../../ast/identity";
import { Editor, ErrorReason, SelectedPosition } from "../../editor/editor";
import { Path } from "../../editor/path";
import { Selection } from "../../editor/selection";

export async function changeSignature(editor: Editor) {
  const { code, selection } = editor;
  const { fixedSelection, params } = getParams(code, selection);

  if (!params) {
    editor.showError(ErrorReason.CantChangeSignature);
    return;
  }

  await editor.askForPositions(params, async (newPositions) => {
    const references = await editor.getSelectionReferences(fixedSelection);

    const filesContent = await Promise.all(
      references.map(async (reference) => {
        const content = await editor.codeOf(reference.path);
        return {
          code: content,
          path: reference.path,
          selection: reference.selection
        };
      })
    );

    const alreadyTransformed: Record<string, string> = {};
    const result: {
      path: Path;
      transformed: t.Transformed;
    }[] = [];

    for (const x of filesContent) {
      const codeToTransform =
        alreadyTransformed[x.path.value] || (x.code as string);

      try {
        const transformed = updateCode(
          t.parse(codeToTransform),
          x.selection,
          newPositions
        );

        alreadyTransformed[x.path.value] = `${transformed.code}`;

        result.push({
          path: x.path,
          transformed
        });
      } catch (error) {
        editor.showError(ErrorReason.CantChangeSignature);
        return;
      }
    }

    await Promise.all(
      result.map(async (result) => {
        await editor.writeIn(
          result.path,
          alreadyTransformed[result.path.value]
        );
      })
    );
  });
}

type Params = { label: string; value: { startAt: number; endAt: number } }[];

function getParams(
  code: string,
  selection: Selection
): { params: Params | null; fixedSelection: Selection } {
  let result: Params | null = null;
  let arrowSelection: Selection = selection;

  t.parseAndTraverseCode(
    code,
    createVisitor(selection, (path, aArrowSelection) => {
      result = path.node.params.map((p, index) => {
        return {
          label: getParamName(p),
          value: {
            startAt: index,
            endAt: index
          }
        };
      });

      arrowSelection = aArrowSelection;
      path.stop();
    })
  );

  return {
    params: result,
    fixedSelection: arrowSelection
  };
}

function updateCode(
  ast: t.AST,
  selection: Selection,
  newPositions: SelectedPosition[]
): t.Transformed {
  return t.transformAST(
    ast,
    createVisitorForReferences(selection, (path) => {
      const node = path.node;

      if (t.isCallExpression(node)) {
        const args = node.arguments.slice();
        if (args.length) {
          newPositions.forEach((order) => {
            const arg = node.arguments[order.value.startAt];
            args[order.value.endAt] = arg;
          });
        }

        const newArgs = args.map((arg) => {
          if (arg) return arg;

          return t.identifier("undefined");
        });
        node.arguments = newArgs;
      } else if (
        isFunctionDeclarationOrArrowFunction(node) ||
        t.isClassMethod(node)
      ) {
        const params = node.params.slice();
        if (params.length) {
          newPositions.forEach((order) => {
            const arg = node.params[order.value.startAt];
            params[order.value.endAt] = arg;
          });
        }

        node.params = params;
      }

      path.stop();
    })
  );
}

export function createVisitor(
  selection: Selection,
  onMatch: (
    path: t.NodePath<
      t.FunctionDeclaration | t.ArrowFunctionExpression | t.ClassMethod
    >,
    arrowSelection: Selection
  ) => void
): t.Visitor {
  return {
    FunctionDeclaration(path) {
      if (!selection.isInsidePath(path)) return;

      onMatch(path, selection);
    },
    ArrowFunctionExpression(path) {
      if (!selection.isInsidePath(path)) return;

      if (!t.isVariableDeclarator(path.parent)) return;

      if (!path.parent.loc) return;

      onMatch(path, Selection.fromAST(path.parent.loc));
    },
    ClassMethod(path) {
      if (!selection.isInsidePath(path)) return;
      onMatch(path, selection);
    }
  };
}

function getParamName(
  param:
    | t.Identifier
    | t.Pattern
    | t.RestElement
    | t.LVal
    | t.ObjectProperty
    | t.PatternLike
    | t.Expression
    | t.PrivateName
): string {
  if ("name" in param) {
    return param.name;
  }

  if (t.isRestElement(param)) {
    return `...${getParamName(param.argument)}`;
  }

  if (t.isObjectPattern(param)) {
    const names: string[] = param.properties.map((property) => {
      if ("key" in property) return getParamName(property.key);

      return getParamName(property);
    });
    // For object destructuring put {param} as name
    return `{${names.join(", ")}}`;
  }

  if (t.isAssignmentPattern(param)) {
    return getParamName(param.left);
  }

  if (t.isArrayPattern(param)) {
    const names: string[] = param.elements.map((element) => {
      return getParamName(element as t.PatternLike);
    });

    // For array destructuring put [param] as name
    return `[${names.join(", ")}]`;
  }

  return "unknown";
}

function createVisitorForReferences(
  selection: Selection,
  onMatch: (path: t.NodePath) => void
): t.Visitor {
  return {
    CallExpression(path) {
      const nodeSelection = new Selection(
        [path.node.loc?.start.line || 0, 0],
        [path.node.loc?.end.line || 0, 0]
      );

      if (!selection.isSameLineThan(nodeSelection)) return;

      onMatch(path);
    },
    FunctionDeclaration(path) {
      if (!selection.isInsidePath(path)) return;
      onMatch(path);
    },
    ArrowFunctionExpression(path) {
      if (!selection.isInsidePath(path)) return;

      onMatch(path);
    },
    ClassMethod(path) {
      if (!selection.isInsidePath(path)) return;
      onMatch(path);
    }
  };
}
