import { RefactoringWithActionProviderConfig__DEPRECATED } from "../../refactorings";
import {
  convertSwitchToIfElse,
  createVisitor
} from "./convert-switch-to-if-else";

const config: RefactoringWithActionProviderConfig__DEPRECATED = {
  command: {
    key: "convertSwitchToIfElse",
    operation: convertSwitchToIfElse,
    title: "Convert Switch to If/Else"
  },
  actionProvider: {
    message: "Convert switch to if/else",
    createVisitor,
    isPreferred: true
  }
};

export default config;
