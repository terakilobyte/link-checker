import * as vscode from "vscode";
import * as linkify from "linkifyjs";
import axios, { AxiosRequestConfig } from "axios";
import { gDC, ghClient, gContext, infoChannel } from "./extension";

const gDA = Array<vscode.Diagnostic>();

export const linkCheck = () => {
  let config = vscode.workspace.getConfiguration("linkChecker");
  infoChannel.appendLine(JSON.stringify(config));
  const document = vscode.window.activeTextEditor?.document;
  gDC.clear();
  const validateLinks = () => {
    if (document === undefined) {
      return;
    }
    // Use replace() to fix issue with HTML tags immediately following a Markdown hyperlink
    let text = document
      .getText()
      .replace(/\((.*?)\)</g, "($1) <")
      .split("\n");
    text.forEach((line, idx) => {
      let links = Array<linkify.FindResultHash>();
      let rstMatches = line.match(/<(.*)>`_/);
      if (rstMatches && rstMatches.length === 2) {
        links.push({ type: "url", value: rstMatches[1], href: rstMatches[1] });
      } else {
        links = linkify
          .find(line)
          .filter((link) => /https?:\/\//.test(link.value));
      }
      links.forEach((link) => {
        if (link.type !== "url") {
          return;
        }
        let position = line.search(link.value);
        if (
          link.href.startsWith("https://github.com/") ||
          link.href.startsWith("http://github.com/")
        ) {
          let [owner, repo, ..._rest] = link.href
            .replace(/https?:\/\/github\.com\//, "")
            .split("/");
          return ghClient.repos
            .get({ owner, repo })
            .then((res: any) => {
              let lastPushed = Date.parse(res.data.pushed_at);
              if ((Date.now() - lastPushed) / (1000 * 3600 * 24 * 365) > 1) {
                throw new Error("stale repository");
              }
            })
            .catch((e: Error) => reportError(e, document, idx, position, link));
        }

        getURL(link.href)
          .then((response) => {
            let status = response.status;
            if (status !== 200) {
              throw new Error(status.toString());
            }
          })
          .catch((e) => reportError(e, document, idx, position, link));
      });
    });
  };

  validateLinks();
};
const reportError = (
  e: Error,
  document: vscode.TextDocument,
  idx: number,
  position: number,
  link: linkify.FindResultHash,
) => {
  let severity;
  if (e.message.includes("Request failed with status code 301")) {
    severity = vscode.DiagnosticSeverity.Information;
    e.message = "301 redirect";
  } else if (e.message === "stale repository") {
    severity = vscode.DiagnosticSeverity.Warning;
  } else {
    severity = vscode.DiagnosticSeverity.Error;
  }
  let err = new vscode.Diagnostic(
    new vscode.Range(
      new vscode.Position(idx, position),
      new vscode.Position(idx, position + link.value.length),
    ),
    e.message,
    severity,
  );
  err.source = "Link Checker";
  gDA.push(err);
  gDC.set(document.uri, gDA);
  gContext.subscriptions.push(gDC);
};
const getURL = (url: string, options: AxiosRequestConfig = {}) => {
  if (!options.timeout) {
    options.maxRedirects = 0;
    options.timeout = 5000;
  }
  const abort = axios.CancelToken.source();
  const id = setTimeout(
    () => abort.cancel(`Timed out after ${options.timeout}ms`),
    options.timeout,
  );
  return axios
    .get(url, { cancelToken: abort.token, ...options })
    .then((res) => {
      clearTimeout(id);
      return res;
    });
};
