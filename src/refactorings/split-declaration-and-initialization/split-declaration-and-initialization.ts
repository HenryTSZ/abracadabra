import { Editor, ErrorReason } from "../../editor/editor";
import { Selection } from "../../editor/selection";
import * as t from "../../ast";

export async function splitDeclarationAndInitialization(editor: Editor) {
  const { code, selection } = editor;
  const updatedCode = updateCode(t.parse(code), selection);

  if (!updatedCode.hasCodeChanged) {
    editor.showError(ErrorReason.DidNotFindDeclarationToSplit);
    return;
  }

  await editor.write(updatedCode.code);
}

function updateCode(ast: t.AST, selection: Selection): t.Transformed {
  return t.transformAST(
    ast,
    createVisitor(selection, (path: t.NodePath<t.VariableDeclaration>) => {
      const declarations = path.node.declarations;
      const kind = path.node.kind === "const" ? "let" : path.node.kind;
      t.replaceWithMultiplePreservingComments(path, [
        t.variableDeclaration(
          kind,
          declarations.flatMap(({ id }) => createVariableDeclarators(id))
        ),
        ...declarations.filter(isDeclarationInitialized).map(({ id, init }) => {
          if (t.isIdentifier(id) && id.typeAnnotation) {
            // Create identifier without type annotation
            id = t.identifier(id.name);
          }

          return t.expressionStatement(t.assignmentExpression("=", id, init));
        })
      ]);
    })
  );
}

function createVariableDeclarators(leftValue: t.LVal): t.VariableDeclarator[] {
  const identifiers = t.isObjectPattern(leftValue)
    ? objectPatternLVals(leftValue)
    : [leftValue];

  return identifiers.map((id) => t.variableDeclarator(id));
}

function objectPatternLVals(objectPattern: t.ObjectPattern): t.LVal[] {
  return objectPattern.properties
    .map((property) => {
      return t.isRestElement(property) ? property.argument : property.key;
    })
    .filter((lval): lval is t.LVal => t.isLVal(lval));
}

export function createVisitor(
  selection: Selection,
  onMatch: (path: t.NodePath<t.VariableDeclaration>) => void
): t.Visitor {
  return {
    VariableDeclaration(path) {
      if (!selection.isInsidePath(path)) return;

      // Since we visit nodes from parent to children, first check
      // if a child would match the selection closer.
      if (hasChildWhichMatchesSelection(path, selection)) return;

      const declarations = path.node.declarations;
      if (!hasInitializedDeclaration(declarations)) return;

      onMatch(path);
    }
  };
}

function hasChildWhichMatchesSelection(
  path: t.NodePath,
  selection: Selection
): boolean {
  let result = false;

  path.traverse({
    VariableDeclaration(childPath) {
      if (!selection.isInsidePath(childPath)) return;

      result = true;
      childPath.stop();
    }
  });

  return result;
}

function hasInitializedDeclaration(
  declarations: t.VariableDeclarator[]
): boolean {
  return declarations.some(isDeclarationInitialized);
}

function isDeclarationInitialized(
  declaration: t.VariableDeclarator
): declaration is t.VariableDeclarator & { init: t.Expression } {
  return declaration.init !== null;
}
