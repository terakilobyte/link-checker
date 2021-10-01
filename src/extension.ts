// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { linkCheck } from "./linkCheck";
const { Octokit } = require("@octokit/rest");

export let gContext: vscode.ExtensionContext;
export let gDC: vscode.DiagnosticCollection;
export let ghClient: any;
export let infoChannel: vscode.OutputChannel;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let apiToken = vscode.workspace
    .getConfiguration("linkChecker")
    .get("linkCheckerToken");
  if (!apiToken) {
    vscode.window.showInformationMessage(
      "Be sure to set your `linkChecker.linkCheckerToken` value in your user settings to avoid Github API rate limiting",
    );
  }
  if (!ghClient) {
    ghClient = new Octokit({ auth: apiToken });
  }
  if (!gContext) {
    gContext = context;
  }
  if (!gDC) {
    gDC = vscode.languages.createDiagnosticCollection("link-checker");
  }

  if (!infoChannel) {
    infoChannel = vscode.window.createOutputChannel("linkChecker");
  }
  gContext.subscriptions.push(gDC);
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "link-checker" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "extension.link-check",
    () => {
      // The code you place here will be executed every time your command is executed
      linkCheck();
    },
  );

  context.subscriptions.push(disposable);
  vscode.workspace.onDidSaveTextDocument(linkCheck);
  vscode.workspace.onDidOpenTextDocument(linkCheck);
  vscode.window.onDidChangeActiveTextEditor((e) => linkCheck(e?.document));
  linkCheck();
}

// this method is called when your extension is deactivated
export function deactivate() {}
