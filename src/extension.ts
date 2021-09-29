// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { linkCheck } from "./linkCheck";
const Octokit = require("@octokit/rest");

export let gContext: vscode.ExtensionContext;
export let gDC: vscode.DiagnosticCollection;
export let ghClient: any;
export let infoChannel: vscode.OutputChannel;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let apiToken = process.env.LINK_CHECKER_TOKEN;
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

  linkCheck();
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "extension.link-check",
    () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      // vscode.window.showInformationMessage("Link Check!");
      linkCheck();
    },
  );

  context.subscriptions.push(disposable);
  vscode.workspace.onDidSaveTextDocument(() => {
    linkCheck();
  });
}

// this method is called when your extension is deactivated
export function deactivate() {}
