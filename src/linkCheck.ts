import * as vscode from "vscode";
import * as linkify from "linkifyjs";
import axios, { AxiosRequestConfig } from "axios";
import { gDC, ghClient, gContext, infoChannel } from "./extension";

let gDA = Array<vscode.Diagnostic>();

type LinkError = {
  e: Error;
  document: vscode.TextDocument;
  idx: number;
  position: number;
  link: linkify.FindResultHash;
};
enum LinkStatus {
  PENDING,
  OK,
  NOTOK,
}
type LinkResult = {
  linkStatus: LinkStatus | undefined;
  linkError: LinkError | undefined;
};

let seenUrls = new Map<String, LinkResult>();

export const linkCheck = () => {
  let config = vscode.workspace.getConfiguration("linkChecker");
  infoChannel.appendLine(JSON.stringify(config));
  const document = vscode.window.activeTextEditor?.document;
  gDC.clear();
  gDA = Array<vscode.Diagnostic>();
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
        let position = line.indexOf(link.value);
        if (position < 0) {
          console.error("negative position", position, link);
        }
        if (!seenUrls.has(link.href)) {
          seenUrls.set(link.href, {
            linkStatus: LinkStatus.PENDING,
            linkError: undefined,
          });
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
                seenUrls.set(link.href, {
                  linkStatus: LinkStatus.OK,
                  linkError: undefined,
                });
              })
              .catch((e: Error) => {
                let linkError = createError(e, document, idx, position, link);
                seenUrls.set(link.href, {
                  linkStatus: LinkStatus.NOTOK,
                  linkError,
                });
                reportError(linkError);
              });
          } else {
            getURL(link.href)
              .then((response) => {
                let status = response.status;
                if (status !== 200) {
                  throw new Error(status.toString());
                }
                seenUrls.set(link.href, {
                  linkStatus: LinkStatus.OK,
                  linkError: undefined,
                });
              })
              .catch((e) => {
                let linkError = createError(e, document, idx, position, link);
                seenUrls.set(link.href, {
                  linkStatus: LinkStatus.NOTOK,
                  linkError,
                });
                reportError(linkError);
              });
          }
        } else if (seenUrls.get(link.href)?.linkStatus === LinkStatus.NOTOK) {
          reportError(
            createError(
              seenUrls.get(link.href)?.linkError?.e as Error,
              document,
              idx,
              position,
              link,
            ),
          );
        }
      });
    });
  };

  validateLinks();
};

const createError = (
  e: Error,
  document: vscode.TextDocument,
  idx: number,
  position: number,
  link: linkify.FindResultHash,
): LinkError => {
  return {
    e,
    document,
    idx,
    position,
    link,
  };
};
const reportError = (linkError: LinkError) => {
  let severity;
  if (linkError.e.message.includes("Request failed with status code 301")) {
    severity = vscode.DiagnosticSeverity.Information;
    linkError.e.message = "301 redirect";
  } else if (linkError.e.message === "stale repository") {
    severity = vscode.DiagnosticSeverity.Warning;
  } else {
    severity = vscode.DiagnosticSeverity.Error;
  }
  if (linkError.idx < 0 || linkError.position < 0) {
    console.error(linkError);
  }
  let err = new vscode.Diagnostic(
    new vscode.Range(
      new vscode.Position(linkError.idx, linkError.position),
      new vscode.Position(
        linkError.idx,
        linkError.position + linkError.link.value.length,
      ),
    ),
    linkError.e.message,
    severity,
  );
  err.source = "Link Checker";
  gDA.push(err);
  gDC.set(linkError.document.uri, gDA);
  gContext.subscriptions.push(gDC);
};
const getURL = (url: string, options: AxiosRequestConfig = {}) => {
  if (!options.timeout) {
    options.maxRedirects = 2;
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
