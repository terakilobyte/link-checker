import {
  TextDocument,
  DocumentLink,
  DiagnosticCollection,
  Diagnostic,
  ExtensionContext,
} from "vscode";
import { LinkResult } from "../linkStates";
import { parseResult } from "./Default";

export interface ILCProvider {
  readonly regex: RegExp;
  dictionary?: any;
  loadDictionary(): Promise<boolean>;
  checkLinks(
    seenUrls: Map<string, LinkResult>,
    document: TextDocument,
    dc: DiagnosticCollection,
    da: Diagnostic[],
    context: ExtensionContext,
  ): void;
  provideDocumentLinks(document: TextDocument): DocumentLink[];
  parse(document: TextDocument): parseResult[];
}
