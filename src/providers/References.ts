import { TextDocument, DocumentLink, Range, Uri } from "vscode";
import fetchInvFile from "../parsers/intersphinx";
import readSnootyToml from "../parsers/snootyToml";
import { DefaultProvider, parseResult } from "./Default";
import { populateRoleMap } from "../parsers/roles";

type refMap = { [key: string]: any };

export default class ReferencesProvider extends DefaultProvider {
  regex: RegExp;
  dictionary?: any;

  constructor() {
    super();
    this.regex = /:(.*):`.*<(.*)>`/g;
  }

  async loadDictionary(): Promise<boolean> {
    try {
      let snootyToml = await readSnootyToml();
      let intermediateMap = await snootyToml.intersphinx.reduce(
        asyncReducer,
        {},
      );
      this.dictionary = {
        ...Object.keys(intermediateMap).reduce((acc, curr) => {
          return { ...acc, ...intermediateMap[curr] };
        }, {}),
        ...(await populateRoleMap()),
      };
      return true;
    } catch (e) {
      return false;
    }
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
      if (this.dictionary[match[2]] && match[1] === "ref") {
        let href = this.dictionary[match[2]];
        let range = new Range(
          document.positionAt(match.index + match[0].indexOf(match[2])),
          document.positionAt(
            match.index + match[0].indexOf(match[2]) + match[2].length,
          ),
        );
        results.push({
          value: match[2],
          range,
          href,
        });
      } else if (
        match[1] !== "ref" &&
        this.dictionary[match[1]] !== undefined
      ) {
        let href = this.dictionary[match[1]].replace("%s", match[2]);
        let range = new Range(
          document.positionAt(match.index + match[0].indexOf(match[2])),
          document.positionAt(
            match.index + match[0].indexOf(match[2]) + match[2].length,
          ),
        );
        results.push({
          value: match[2],
          range,
          href,
        });
      } else {
        let range = new Range(
          document.positionAt(match.index + match[0].indexOf(match[2])),
          document.positionAt(
            match.index + match[0].indexOf(match[2]) + match[2].length,
          ),
        );
        let href = "https://a.bad.ref";
        let value = match[2];
        results.push({
          value,
          range,
          href,
        });
      }
    }
    return results;
  }
}

async function populateRefs(
  url: string,
  referenceMap: refMap = {},
): Promise<refMap> {
  let refs = await fetchInvFile(url);
  let source = url.slice(0, url.indexOf("objects.inv"));
  return refs.split("\n").reduce((acc, line) => {
    let [name, _role, _priority, url, ..._display] = line.split(" ");
    if (!name) {
      return acc;
    }
    acc[name] = source + url;
    return acc;
  }, referenceMap);
}

async function asyncReducer(acc: any, curr: any) {
  try {
    let data = await populateRefs(curr);
    return { ...(await acc), [curr]: data };
  } catch (error) {
    return { ...(await acc), [curr]: { error } };
  }
}
