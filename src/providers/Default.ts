import {
  TextDocument,
  DocumentLink,
  Range,
  DiagnosticCollection,
  Diagnostic,
  ExtensionContext,
} from "vscode";
import { LinkFindResult } from "../linkCheck";
import { LinkResult } from "../linkStates";
import { getLinkStatus } from "../utils";
import { ILCProvider } from "./ILCProvider";

export type parseResult = {
  range: Range;
  href: string;
  value: string;
};

export abstract class DefaultProvider implements ILCProvider {
  regex: RegExp;
  dictionary?: any;
  constructor() {
    this.regex = /\s/g;
  }
  loadDictionary(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  checkLinks(
    seenUrls: Map<string, LinkResult>,
    document: TextDocument,
    dc: DiagnosticCollection,
    da: Diagnostic[],
    context: ExtensionContext,
  ): void {
    this.parse(document)
      .map(({ value, href, range }) => ({
        type: "url",
        value,
        href,
        range,
      }))
      .forEach((link) => {
        getLinkStatus(
          seenUrls,
          link as LinkFindResult,
          document.uri,
          dc,
          da,
          context,
        );
      });
  }
  provideDocumentLinks(document: TextDocument): DocumentLink[] {
    throw new Error("Method not implemented.");
  }
  parse(document: TextDocument): parseResult[] {
    throw new Error("Method not implemented.");
  }
}
