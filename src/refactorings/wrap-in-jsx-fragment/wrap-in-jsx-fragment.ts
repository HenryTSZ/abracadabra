import * as t from "../../ast";
import { Editor, ErrorReason } from "../../editor/editor";
import { Selection } from "../../editor/selection";

export async function wrapInJsxFragment(editor: Editor) {
  const { code, selection } = editor;
  const updatedCode = updateCode(t.parse(code), selection);

  if (!updatedCode.hasCodeChanged) {
    editor.showError(ErrorReason.CouldNotWrapInJsxFragment);
    return;
  }

  await editor.write(updatedCode.code);
}

function updateCode(ast: t.AST, selection: Selection): t.Transformed {
  return t.transformAST(
    ast,
    createVisitor(selection, (path, node) => {
      t.replaceWithPreservingComments(path, node);
    })
  );
}

export function createVisitor(
  selection: Selection,
  onMatch: (path: t.NodePath, node: t.Node) => void
): t.Visitor {
  return {
    JSXElement(path) {
      if (!selection.isInsidePath(path)) return;

      // Since we visit nodes from parent to children, first check
      // if a child would match the selection closer.
      if (hasChildWhichMatchesSelection(path, selection)) return;

      const extra = path.node.extra;
      const fragment = t.jsxFragment(
        t.jsxOpeningFragment(),
        t.jsxClosingFragment(),
        [{ ...path.node, extra: { parenthesized: false } }]
      );
      path.replaceWith(fragment);
      onMatch(path, { ...path.node, extra });
      path.stop();
    }
  };
}

function hasChildWhichMatchesSelection(
  path: t.NodePath,
  selection: Selection
): boolean {
  let result = false;

  path.traverse({
    JSXElement(childPath) {
      if (!selection.isInsidePath(childPath)) return;

      result = true;
    }
  });

  return result;
}
