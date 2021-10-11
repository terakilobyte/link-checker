import { TextDocument, DocumentLink, Range, Uri } from "vscode";
import fetchInvFile from "../parsers/intersphinxParser";
import readSnootyToml from "../parsers/snootyTomlParser";
import { DefaultProvider, parseResult } from "./Default";
import { populateRoleMap } from "../parsers/rolesParser";
import { getLocalRefs } from "../parsers/localRefParser";

type refMap = { [key: string]: any };

export default class ReferencesProvider extends DefaultProvider {
  regex: RegExp;
  dictionary?: any;

  constructor() {
    super();
    this.regex =
      /:([\w\s\-_=+!@#$%^&*(\)]*):`([\w\s\-_=+!@#$%^&*(\)]*)<?([\w\s\-_=+!@#$%^&*(\)]*)>?/g;
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
      let whichMatch = match[1] === "ref" && refWithBrackets(match) ? 3 : 2;
      if (this.dictionary[match[whichMatch]] && match[1] === "ref") {
        // :ref:`decription <ref-name>` vs :ref:`ref-name`
        let value = match[whichMatch];
        let href = this.dictionary[match[whichMatch]];
        let range = new Range(
          document.positionAt(match.index + match[0].indexOf(match[3])),
          document.positionAt(
            match.index + match[0].indexOf(match[3]) + match[3].length,
          ),
        );
        results.push({
          value,
          range,
          href,
        });
      } else if (match[1] === "ref") {
        // :ref:`decription <ref-name>` vs :ref:`ref-name`
        let value = match[whichMatch];
        let href = `https://no.${value}.was.found`;
        let range;
        range = new Range(
          document.positionAt(
            match.index + match[0].indexOf(match[whichMatch]),
          ),
          document.positionAt(
            match.index +
              match[0].indexOf(match[whichMatch]) +
              match[whichMatch].length,
          ),
        );
        results.push({
          value,
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
        // don't handle doc links
      } else if (match[1] !== "doc") {
        let range = new Range(
          document.positionAt(match.index + match[0].indexOf(match[2])),
          document.positionAt(
            match.index + match[0].indexOf(match[2]) + match[2].length,
          ),
        );
        let value = match[2];
        let href = `https://no.${value}.was.found`;
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

const refWithBrackets = (match: RegExpExecArray) => {
  return match[3] !== "";
};
