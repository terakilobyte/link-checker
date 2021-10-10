import { TextDocument, DocumentLink, Range, Uri } from "vscode";
import { DefaultProvider, parseResult } from "./Default";
import readConstants from "../parsers/constantsParser";
import readSnootyToml from "../parsers/snootyTomlParser";

export default class ConstantsProvider extends DefaultProvider {
  regex: RegExp;
  dictionary?: any;

  constructor() {
    super();
    this.regex = /<\{\+(.*)\+\}(\/.*)>`/g;
  }

  async loadDictionary(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        this.dictionary = readConstants((await readSnootyToml()).constants);
        resolve(true);
      } catch (e) {
        reject(false);
      }
    });
  }

  provideDocumentLinks(document: TextDocument): DocumentLink[] {
    let links = Array<DocumentLink>();
    let results = this.parse(document);

    return results.map(
      ({ href, range }) => new DocumentLink(range, Uri.parse(href)),
    );
  }

  parse(document: TextDocument): parseResult[] {
    let match: RegExpExecArray | null;
    let results = Array<parseResult>();

    while ((match = this.regex.exec(document.getText())) !== null) {
      let href = this.dictionary[match[1]] + match[2];
      let range = new Range(
        document.positionAt(match.index + 1),
        document.positionAt(match.index + match[0].length - 2),
      );
      results.push({
        value: match[1] + match[2],
        href,
        range,
      });
    }
    return results;
  }
}
