import { singular } from "pluralize";

import * as t from "../../ast";
import { InMemoryEditor } from "../../editor/adapters/in-memory-editor";
import { Editor, ErrorReason } from "../../editor/editor";
import { Position } from "../../editor/position";
import { Selection } from "../../editor/selection";

export async function convertForToForEach(editor: Editor) {
  const { code, selection } = editor;
  const updatedCode = updateCode(t.parse(code), selection);

  if (!updatedCode.hasCodeChanged) {
    editor.showError(ErrorReason.DidNotFindForLoopToConvert);
    return;
  }

  // Recast would add an empty line before the transformed node.
  // If that's the case, get rid of it before we write the new code.
  const inMemoryEditor = new InMemoryEditor(updatedCode.code);
  if (inMemoryEditor.isLineBlank(updatedCode.forLoopStartLine)) {
    inMemoryEditor.removeLine(updatedCode.forLoopStartLine);
  }

  await editor.write(inMemoryEditor.code);
}

function updateCode(
  ast: t.AST,
  selection: Selection
): t.Transformed & { forLoopStartLine: number } {
  let forLoopStartLine = selection.start.line;

  const result = t.transformAST(
    ast,
    createVisitor(selection, (path, getParams, list) => {
      const { body } = path.node;
      const forEachBody = t.isBlockStatement(body)
        ? body
        : t.blockStatement([body]);

      forLoopStartLine = Position.fromAST(path.node.loc.start).line;
      t.replaceWithPreservingComments(
        path,
        t.forEach(list, getParams(forEachBody), forEachBody)
      );
      path.stop();
    })
  );

  return { ...result, forLoopStartLine };
}

export function createVisitor(
  selection: Selection,
  onMatch: (
    path: t.SelectablePath<t.ForStatement | t.ForOfStatement>,
    getParams: (
      body: t.BlockStatement
    ) => (t.Identifier | t.ObjectPattern | t.ArrayPattern)[],
    list: List | t.Expression
  ) => void
): t.Visitor {
  return {
    ForStatement(path) {
      if (!selection.isInsidePath(path)) return;

      // Since we visit nodes from parent to children, first check
      // if a child would match the selection closer.
      if (hasChildWhichMatchesSelection(path, selection)) return;

      const { init, test } = path.node;
      if (!t.isBinaryExpression(test)) return;
      if (!t.isVariableDeclaration(init)) return;
      if (!startsFrom0(init)) return;

      const left = test.left;
      if (!t.isIdentifier(left)) return;

      const list = getList(test, init);
      if (!list) return;

      onMatch(
        path,
        (body) => {
          const listName = getListName(list);
          const newName =
            singular(listName) === listName
              ? `${listName}Item`
              : singular(listName);
          const item = t.identifier(newName);
          replaceListWithItemIn(body, list, left, item, path.scope);

          // After we replaced, we check if there are remaining accessors.
          return isAccessorReferencedIn(body, left) ? [item, left] : [item];
        },
        list
      );
    },

    ForOfStatement(path) {
      if (!selection.isInsidePath(path)) return;

      const { left, right } = path.node;
      if (!t.isVariableDeclaration(left)) return;
      if (!isList(right, path)) return;

      const identifier = getIdentifier(left);
      if (!identifier) return;

      onMatch(path, () => [identifier], right);
    }
  };
}

function isList(expression: t.Expression, path: t.NodePath<t.ForOfStatement>) {
  if (t.isArrayExpression(expression)) return true;
  if (t.isMemberExpression(expression)) return true;
  if (!t.isIdentifier(expression)) return false;
  const identifier = expression as t.Identifier;
  return identifierPointsToArray(identifier.name, path);
}

function identifierPointsToArray(
  name: string,
  path: t.NodePath<t.ForOfStatement>
) {
  const binding = path.scope.getBinding(name);
  if (!binding) return false;
  const parent = binding.path.parent as t.VariableDeclaration;
  if (!t.isVariableDeclaration(parent)) return false;
  if (parent.declarations.length !== 1) return false;
  const value = parent.declarations[0].init;
  return t.isArrayExpression(value);
}

function hasChildWhichMatchesSelection(
  path: t.NodePath,
  selection: Selection
): boolean {
  let result = false;

  path.traverse({
    ForStatement(childPath) {
      if (!selection.isInsidePath(childPath)) return;

      const { init, test } = childPath.node;
      if (!t.isBinaryExpression(test)) return;
      if (!t.isVariableDeclaration(init)) return;
      if (!startsFrom0(init)) return;

      if (!t.isIdentifier(test.left)) return;

      if (!getList(test, init)) return;

      result = true;
      childPath.stop();
    }
  });

  return result;
}

function startsFrom0({ declarations }: t.VariableDeclaration): boolean {
  const numeric0 = t.numericLiteral(0);

  return declarations.reduce<boolean>((result, { init }) => {
    if (t.isNumericLiteral(init) && !t.areEquivalent(init, numeric0)) {
      return false;
    }

    return result;
  }, true);
}

function getList(
  expression: t.BinaryExpression,
  variableDeclaration: t.VariableDeclaration
): List | undefined {
  return (
    getListFromBinaryExpression(expression) ||
    getListFromVariableDeclaration(variableDeclaration)
  );
}

function getListFromBinaryExpression(
  expression: t.BinaryExpression
): List | undefined {
  const { right } = expression;

  return t.isBinaryExpression(right)
    ? getListFromMemberExpression(right.left)
    : getListFromMemberExpression(right);
}

function getListFromVariableDeclaration(
  variableDeclaration: t.VariableDeclaration
): List | undefined {
  let result: List | undefined;

  variableDeclaration.declarations.forEach(({ init }) => {
    if (t.isBinaryExpression(init)) {
      result = getListFromMemberExpression(init.left);
    }
  });

  return result;
}

function getListFromMemberExpression(node: t.Node): List | undefined {
  if (!t.isMemberExpression(node)) return;

  const { object, property } = node;
  if (!t.areEquivalent(property, t.identifier("length"))) return;
  if (!(t.isIdentifier(object) || t.isMemberExpression(object))) return;

  return object;
}

function getIdentifier(
  declaration: t.VariableDeclaration
): t.Identifier | t.ObjectPattern | t.ArrayPattern | undefined {
  // for...of doesn't support multiple declarations anyway.
  if (declaration.declarations.length !== 1) return;
  const id = declaration.declarations[0].id;
  if (!t.isIdentifier(id) && !t.isObjectPattern(id) && !t.isArrayPattern(id))
    return;
  return id;
}

function getListName(list: List): string {
  if (t.isIdentifier(list)) {
    return list.name;
  }
  if (t.isMemberExpression(list.property) || t.isIdentifier(list.property)) {
    return getListName(list.property);
  }

  return "item";
}

function replaceListWithItemIn(
  statement: t.BlockStatement,
  list: List,
  accessor: t.Identifier,
  item: t.Identifier,
  scope: t.Scope
) {
  t.traversePath(
    statement,
    {
      MemberExpression(path) {
        if (!t.areEquivalent(path.node.object, list)) return;
        if (!t.areEquivalent(path.node.property, accessor)) return;
        if (path.parentPath.isAssignmentExpression()) return;
        path.replaceWith(item);
      }
    },
    scope
  );
}

function isAccessorReferencedIn(
  statement: t.BlockStatement,
  accessor: t.Identifier
): boolean {
  let result = false;

  t.traverseNode(statement, {
    enter(node) {
      if (!t.areEquivalent(node, accessor)) return;
      result = true;
    }
  });

  return result;
}

type List = t.Identifier | t.MemberExpression;
