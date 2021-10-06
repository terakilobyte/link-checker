// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { AnyJson, JsonMap } from "@iarna/toml";
import * as vscode from "vscode";
import { linkCheck } from "./linkCheck";
const { Octokit } = require("@octokit/rest");
import { populateRoleMap } from "./roles";
import { readSnootyToml } from "./parseSnooty";
import { populateRefs } from "./refs";
import { readConstants } from "./constants";

let gDC: vscode.DiagnosticCollection;
let ghClient: any;
let roleMap: AnyJson;
let snootyToml: any;
let referenceMap: any;
let constantMap: any;

const asyncReducer = async (acc: any, curr: any) => {
  try {
    let data = await populateRefs(curr);
    return { ...(await acc), [curr]: data };
  } catch (error) {
    return { ...(await acc), [curr]: { error } };
  }
};
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  let apiToken = vscode.workspace
    .getConfiguration("linkChecker")
    .get("linkCheckerToken");
  if (!apiToken) {
    vscode.window.showInformationMessage(
      "Be sure to set your `linkChecker.linkCheckerToken` value in your user settings to avoid Github API rate limiting",
    );
  }
  if (!ghClient) {
    ghClient = await new Octokit({ auth: apiToken });
  }
  if (!roleMap) {
    roleMap = await populateRoleMap(ghClient);
  }
  if (!gDC) {
    gDC = vscode.languages.createDiagnosticCollection("link-checker");
  }
  if (!snootyToml) {
    try {
      snootyToml = await readSnootyToml();
      let intermediateMap = await snootyToml.intersphinx.reduce(
        asyncReducer,
        {},
      );
      referenceMap = Object.keys(intermediateMap).reduce((acc, curr) => {
        return { ...acc, ...intermediateMap[curr] };
      }, {});
      constantMap = readConstants(snootyToml.constants);
    } catch (e) {
      // do nothing, no snooty.toml file
    }
  }

  context.subscriptions.push(gDC);
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "link-checker" is now active!');
  const checkFunc = (e: vscode.TextDocument | undefined = undefined) => {
    linkCheck(e, ghClient, gDC, context, roleMap, referenceMap, constantMap);
  };
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "extension.link-check",
    checkFunc,
  );

  context.subscriptions.push(disposable);
  vscode.workspace.onDidSaveTextDocument(checkFunc);
  vscode.workspace.onDidOpenTextDocument(checkFunc);
  vscode.window.onDidChangeActiveTextEditor((e) => checkFunc(e?.document));
  checkFunc();
}

// this method is called when your extension is deactivated
export function deactivate() {}
