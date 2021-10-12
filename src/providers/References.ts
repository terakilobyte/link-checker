import { TextDocument, DocumentLink, Range, Uri } from "vscode";
import fetchInvFile from "../parsers/intersphinxParser";
import readSnootyToml from "../parsers/snootyTomlParser";
import { DefaultProvider, parseResult } from "./Default";
import { populateRoleMap } from "../parsers/rolesParser";
import { getLocalRefs } from "../parsers/localRefParser";
import assert = require("assert");

type refMap = { [key: string]: any };

export default class ReferencesProvider extends DefaultProvider {
  regex: RegExp;
  dictionary?: any;

  constructor() {
    super();
    this.regex =
      /:([\w\s\-\.\d_=+!@#$%^&*(\)]*):`([\w\s\-_\.\d\\\/=+!@#$%^&*(\)]*)<?([\w\s\-_\.\d\\\/=+!@#$%^&*(\)]*)>?/g;
  }

  async loadDictionary(): Promise<boolean> {
    try {
      let snootyToml = await readSnootyToml();
      let intermediateMap = await snootyToml.intersphinx.reduce(
        asyncReducer,
        {},
      );
      let localRefs = await getLocalRefs();
      let roleMap = await populateRoleMap();
      this.dictionary = {
        ...Object.keys(intermediateMap).reduce((acc, curr) => {
          return { ...acc, ...intermediateMap[curr] };
        }, {}),
        ...roleMap,
        ...localRefs,
      };
      return true;
    } catch (e) {
      console.error("error loading roles and refs", e);
      throw e;
    }
  }

  provideDocumentLinks(document: TextDocument): DocumentLink[] {
    let results = this.parse(document);

    return results.map(
      ({ href, range }) => new DocumentLink(range, Uri.parse(href)),
    );
  }

  parse(document: TextDocument): parseResult[] {
    let match: RegExpExecArray | null;
    let results = Array<parseResult>();

    while ((match = this.regex.exec(document.getText())) !== null) {
      let whichMatch = refWithBrackets(match) ? 3 : 2;
      // don't handle doc links
      let report;
      if (match[1] === "doc") {
        continue;
      } else if (this.dictionary[match[whichMatch]] && match[1] === "ref") {
        // :ref:`description <ref-name>` vs :ref:`ref-name`
        report = this.report(
          document,
          match,
          whichMatch,
          (value) => this.dictionary[value],
        );
      } else if (
        match[1] !== "ref" &&
        this.dictionary[match[1]] !== undefined
      ) {
        report = this.report(document, match, whichMatch, (value) => {
          assert(match);
          return this.dictionary[match[1]].replace("%s", value);
        });
      } else {
        report = this.report(
          document,
          match,
          whichMatch,
          (value) => `https://no.${value}.was.found`,
        );
      }
      if (report) {
        results.push(report);
      }
    }

    let refDeclarationRegex = /\.\.\s_([\w\d\-_=+!@#$%^&*(\)]*):/g;
    while ((match = refDeclarationRegex.exec(document.getText())) !== null) {
      assert(this.dictionary);
      this.dictionary[match[1]] = Uri.file(document.uri.fsPath);
    }
    return results;
  }

  private report(
    document: TextDocument,
    match: RegExpExecArray,
    whichMatch: number,
    hrefFn: (value: string) => string,
  ) {
    let value = match[whichMatch];
    let href = hrefFn(value);
    let range = getRange(document, match, whichMatch);
    return {
      value,
      range,
      href,
    };
  }
}

function getRange(
  document: TextDocument,
  match: RegExpExecArray,
  whichMatch: number,
) {
  let range;
  range = new Range(
    document.positionAt(match.index + match[0].indexOf(match[whichMatch])),
    document.positionAt(
      match.index +
        match[0].indexOf(match[whichMatch]) +
        match[whichMatch].length,
    ),
  );
  return range;
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

function refWithBrackets(match: RegExpExecArray) {
  return match[3] !== "";
}
