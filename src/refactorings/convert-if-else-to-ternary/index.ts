import {
  createVisitor,
  convertIfElseToTernary
} from "./convert-if-else-to-ternary";

import { RefactoringWithActionProvider } from "../../refactorings";

const config: RefactoringWithActionProvider = {
  command: {
    key: "convertIfElseToTernary",
    operation: convertIfElseToTernary,
    title: "Convert If/Else to Ternary"
  },
  actionProvider: {
    message: "Convert if/else to ternary",
    createVisitor
  }
};

export default config;
