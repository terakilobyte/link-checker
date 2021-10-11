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
      /:([\w\s\-_=+!@#$%^&*(\)]*):`([\w\s\-_=+!@#$%^&*(\)]*)<?([\w\s\-_\.\\\/=+!@#$%^&*(\)]*)>?/g;
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
      if (match[1] === "doc") {
        continue;
      } else if (this.dictionary[match[whichMatch]] && match[1] === "ref") {
        // :ref:`description <ref-name>` vs :ref:`ref-name`
        let value = match[whichMatch];
        let href = this.dictionary[match[whichMatch]];
        let range = getRange(document, match, whichMatch);
        results.push({
          value,
          range,
          href,
        });
      } else if (match[1] === "ref") {
        // :ref:`description <ref-name>` vs :ref:`ref-name`
        let value = match[whichMatch];
        let href = `https://no.${value}.was.found`;
        let range = getRange(document, match, whichMatch);
        results.push({
          value,
          range,
          href,
        });
      } else if (
        match[1] !== "ref" &&
        this.dictionary[match[1]] !== undefined
      ) {
        let href = this.dictionary[match[1]].replace("%s", match[whichMatch]);
        let range = getRange(document, match, whichMatch);
        results.push({
          value: match[whichMatch],
          range,
          href,
        });
      } else {
        let range = getRange(document, match, whichMatch);
        let value = match[whichMatch];
        let href = `https://no.${value}.was.found`;
        results.push({
          value,
          range,
          href,
        });
      }
    }

    let refDeclarationRegex = /\.\.\s_([\w\d\-_=+!@#$%^&*(\)]*):/g;
    while ((match = refDeclarationRegex.exec(document.getText())) !== null) {
      assert(this.dictionary);
      this.dictionary[match[1]] = Uri.file(document.uri.fsPath);
    }
    return results;
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
