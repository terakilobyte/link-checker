// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {
  DiagnosticCollection,
  ExtensionContext,
  workspace,
  window,
  languages,
  TextDocument,
  commands,
} from "vscode";
import LinkChecker from "./linkCheck";
import ConstantsProvider from "./providers/Constants";
import ReferencesProvider from "./providers/References";
import RSTProvider from "./providers/RST";

import { getLocalRefs } from "./parsers/localRefParser";

let gDC: DiagnosticCollection;

const constants = new ConstantsProvider();
const references = new ReferencesProvider();
const rst = new RSTProvider();
const checker = new LinkChecker();

const documentSelector = [
  { language: "plaintext", scheme: "file" },
  { language: "yaml", scheme: "file" },
  { language: "restructuredtext", scheme: "file" },
  { language: "rst", scheme: "file" },
  { language: "RST", scheme: "file" },
  { language: "toml", scheme: "file" },
  { language: "md", scheme: "file" },
  { language: "markdown", scheme: "file" },
];

export async function activate(context: ExtensionContext) {
  await getLocalRefs();
  let apiToken = workspace
    .getConfiguration("linkChecker")
    .get("linkCheckerToken");
  if (!apiToken) {
    window.showInformationMessage(
      "Be sure to set your `linkChecker.linkCheckerToken` value in your user settings to avoid Github API rate limiting",
    );
  }

  if (!gDC) {
    gDC = languages.createDiagnosticCollection("link-checker");
  }

  await constants.loadDictionary();
  await references.loadDictionary();
  checker.registerLCProvider(constants);
  checker.registerLCProvider(references);
  checker.registerLCProvider(rst);

  languages.registerDocumentLinkProvider(documentSelector, checker);

  context.subscriptions.push(gDC);
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "link-checker" is now active!');
  const checkFunc = (e: TextDocument | undefined = undefined) => {
    checker.checkLinks(
      e,
      gDC,
      context,
      documentSelector.map((elem) => elem["language"]),
    );
  };
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = commands.registerCommand("extension.link-check", checkFunc);

  context.subscriptions.push(disposable);
  workspace.onDidSaveTextDocument(checkFunc);
  workspace.onDidOpenTextDocument(checkFunc);
  window.onDidChangeActiveTextEditor((e) => checkFunc(e?.document));
  checkFunc();
}

// this method is called when your extension is deactivated
export function deactivate() {}
