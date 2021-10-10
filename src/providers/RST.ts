import { TextDocument, DocumentLink, Range } from "vscode";
import { DefaultProvider, parseResult } from "./Default";

export default class RSTProvider extends DefaultProvider {
  regex: RegExp;
  dictionary?: any;

  constructor() {
    super();
    this.regex =
      /\(?(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))\)?/g;
  }

  async loadDictionary(): Promise<boolean> {
    return true;
  }

  provideDocumentLinks(document: TextDocument): DocumentLink[] {
    // no need to override vscode built in
    return [];
  }

  parse(document: TextDocument): parseResult[] {
    let match: RegExpExecArray | null;
    let results = Array<parseResult>();

    while ((match = this.regex.exec(document.getText())) !== null) {
      let href = match[1];
      if (match[0].startsWith("(")) {
        if (href.match(/\)/g)?.length) {
          href = href.slice(0, href.lastIndexOf(")"));
        }
      }
      let range = new Range(
        document.positionAt(match.index),
        document.positionAt(match.index + match[0].length),
      );
      results.push({
        value: href,
        href,
        range,
      });
    }
    return results;
  }
}
