export enum ErrorReason {
  DidNotFindBooleanToSimplify,
  DidNotRemoveJsxFragment,
  CouldNotWrapInJsxFragment,
  DidNotFindOperatorToFlip,
  CantChangeSignature,
  DidNotFindClass,
  DidNotFindNumericLiteral,
  DidNotFindIdentifiersToRename,
  DidNotFindStatementToToggleBraces,
  DidNotFindTypeToExtract,
  DidNotFindFunctionDeclarationToConvert,
  CantConvertFunctionDeclarationBecauseUsedBefore,
  DidNotFindLetToConvertToConst,
  DidNotFindSwitchToConvert,
  DidNotFindClassToExtractInterface,
  DidNotFindDeadCode,
  DidNotFindForEachToConvertToForOf,
  DidNotFindForLoopToConvert,
  DidNotFindStatementToMerge,
  DidNotFindNestedIf,
  DidNotFindBinaryExpression,
  DidNotFindExtractableCode,
  DidNotFindInlinableCode,
  DidNotFindInlinableCodeIdentifiers,
  DidNotFindInvertableBooleanLogic,
  DidNotFindRedundantElse,
  DidNotFindIfElseToFlip,
  DidNotFindTernaryToFlip,
  DidNotFindTernaryToSimplify,
  DidNotFindIfElseToConvert,
  DidNotFindTernaryToConvert,
  CantConvertTernaryWithOtherDeclarations,
  DidNotFindIfStatementToSplit,
  DidNotFindIfStatementsToMerge,
  DidNotFindDeclarationToSplit,
  DidNotFindStringToConvert,
  CantMoveStatementUp,
  CantMoveMultiLinesStatementUp,
  CantMoveStatementDown,
  CantMoveMultiLinesStatementDown,
  CantInlineExportedVariables,
  CantInlineRedeclaredVariables,
  CantRemoveExportedFunction,
  CantInlineFunctionWithMultipleReturns,
  CantInlineAssignedFunctionWithoutReturn,
  CantInlineAssignedFunctionWithManyStatements
}

export function toString(reason: ErrorReason): string {
  switch (reason) {
    case ErrorReason.DidNotFindBooleanToSimplify:
      return didNotFind("a boolean to simplify");

    case ErrorReason.DidNotRemoveJsxFragment:
      return didNotFind("a jsx fragment that could safely be removed");

    case ErrorReason.CouldNotWrapInJsxFragment:
      return didNotFind("something to wrap in a JSX fragment");

    case ErrorReason.DidNotFindOperatorToFlip:
      return didNotFind("an operator to flip");

    case ErrorReason.CantChangeSignature:
      return cantDoIt("change function signature");

    case ErrorReason.DidNotFindClass:
      return didNotFind("a class to create a factory for");

    case ErrorReason.DidNotFindNumericLiteral:
      return didNotFind("a numeric literal to add separators to");

    case ErrorReason.DidNotFindIdentifiersToRename:
      return "I didn't find the identifiers to rename. Note that I can only rename *within* the <script> tag of a view file. 🙂";

    case ErrorReason.DidNotFindStatementToToggleBraces:
      return didNotFind("a statement that could toggle braces");

    case ErrorReason.DidNotFindTypeToExtract:
      return didNotFind("a type to extract");

    case ErrorReason.DidNotFindFunctionDeclarationToConvert:
      return didNotFind("a function declaration to convert");

    case ErrorReason.CantConvertFunctionDeclarationBecauseUsedBefore:
      return cantDoIt("convert this function declaration, it's used before");

    case ErrorReason.DidNotFindLetToConvertToConst:
      return didNotFind(
        "a variable declared as let that could be converted to const"
      );

    case ErrorReason.DidNotFindSwitchToConvert:
      return didNotFind("a switch statement to convert");

    case ErrorReason.DidNotFindClassToExtractInterface:
      return didNotFind("a class to extract the interface");

    case ErrorReason.DidNotFindDeadCode:
      return didNotFind("dead code to delete");

    case ErrorReason.DidNotFindForEachToConvertToForOf:
      return didNotFind("a for each to convert");

    case ErrorReason.DidNotFindForLoopToConvert:
      return didNotFind("a valid for loop to convert");

    case ErrorReason.DidNotFindStatementToMerge:
      return didNotFind("a statement to merge with");

    case ErrorReason.DidNotFindNestedIf:
      return didNotFind("a nested if to lift up");

    case ErrorReason.DidNotFindBinaryExpression:
      return didNotFind("a binary expression to convert");

    case ErrorReason.DidNotFindExtractableCode:
      return didNotFind("a valid code to extract");

    case ErrorReason.DidNotFindInlinableCode:
      return didNotFind("a valid code to inline");

    case ErrorReason.DidNotFindInlinableCodeIdentifiers:
      return "I didn't find references of this variable in the code 🤔";

    case ErrorReason.DidNotFindInvertableBooleanLogic:
      return didNotFind("a boolean logic to invert");

    case ErrorReason.DidNotFindRedundantElse:
      return didNotFind("a redundant else to remove");

    case ErrorReason.DidNotFindIfElseToFlip:
      return didNotFind("an if statement to flip");

    case ErrorReason.DidNotFindTernaryToFlip:
      return didNotFind("a ternary to flip");

    case ErrorReason.DidNotFindTernaryToSimplify:
      return didNotFind("a ternary to simplify");

    case ErrorReason.DidNotFindIfElseToConvert:
      return didNotFind("a valid if statement to convert");

    case ErrorReason.DidNotFindTernaryToConvert:
      return didNotFind("a ternary to convert into if statement");

    case ErrorReason.CantConvertTernaryWithOtherDeclarations:
      return cantDoIt("convert a ternary declared along other variables");

    case ErrorReason.DidNotFindIfStatementToSplit:
      return didNotFind("an if statement that can be split");

    case ErrorReason.DidNotFindIfStatementsToMerge:
      return didNotFind("if statements that can be merged");

    case ErrorReason.DidNotFindDeclarationToSplit:
      return didNotFind("a declaration that can be splitted");

    case ErrorReason.DidNotFindStringToConvert:
      return didNotFind("a string to convert into template literal");

    case ErrorReason.CantMoveStatementUp:
      return cantDoIt("move this statement up");

    case ErrorReason.CantMoveMultiLinesStatementUp:
      return cantDoIt("move up a multi-lines selection yet");

    case ErrorReason.CantMoveStatementDown:
      return cantDoIt("move this statement down");

    case ErrorReason.CantMoveMultiLinesStatementDown:
      return cantDoIt("move down a multi-lines selection yet");

    case ErrorReason.CantInlineExportedVariables:
      return cantDoIt("inline exported variables yet");

    case ErrorReason.CantInlineRedeclaredVariables:
      return cantDoIt("inline redeclared variables yet");

    case ErrorReason.CantRemoveExportedFunction:
      return "I didn't remove the function because it's exported 🤓";

    case ErrorReason.CantInlineFunctionWithMultipleReturns:
      return cantDoIt("inline a function with multiple returns");

    case ErrorReason.CantInlineAssignedFunctionWithoutReturn:
      return cantDoIt("inline an assigned function without return");

    case ErrorReason.CantInlineAssignedFunctionWithManyStatements:
      return cantDoIt("inline an assigned function with many statements");

    default:
      return "I'm sorry, something went wrong but I'm not sure what 😅";
  }
}

export function didNotFind(element: string): string {
  return `I didn't find ${element} from current selection 🤔`;
}

function cantDoIt(element: string): string {
  return `I'm sorry, I can't ${element} 😅`;
}
