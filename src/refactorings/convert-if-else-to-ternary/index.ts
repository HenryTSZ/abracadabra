import { RefactoringWithActionProviderConfig__DEPRECATED } from "../../refactorings";
import {
  convertIfElseToTernary,
  createVisitor
} from "./convert-if-else-to-ternary";

const config: RefactoringWithActionProviderConfig__DEPRECATED = {
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
