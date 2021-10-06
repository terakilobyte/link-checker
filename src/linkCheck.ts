import * as vscode from "vscode";
import * as linkify from "linkifyjs";
import axios, { AxiosRequestConfig } from "axios";
import { LinkError, LinkResult, LinkStatus } from "./linkStates";
import { link } from "fs";

let gDA = Array<vscode.Diagnostic>();

let seenUrls = new Map<String, LinkResult>();
const supportedLanguages = ["rst", "restructuredtext", "txt", "markdown", "md"];

export const linkCheck = (
  document = vscode.window.activeTextEditor?.document,
  ghClient: any,
  gDC: vscode.DiagnosticCollection,
  context: vscode.ExtensionContext,
  roleMap: any,
  refMap: any,
  constantMap: any,
) => {
  if (!document || !supportedLanguages.includes(document?.languageId)) {
    return;
  }
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
      let roleMatches = line.match(/:(.*):`.*<(.*)>`/);
      let refMatches = line.match(/:ref:.*<(.*)>`/);
      if (rstMatches) {
        // check for constant links
        let constMatch = rstMatches[1].match(/\{\+(.*)\+\}/);
        if (constMatch) {
          let href =
            constantMap[constMatch[1]] +
            rstMatches[1].slice(constMatch[0].length);
          console.log("CONSTANT VALUE", rstMatches[1]);
          console.log("CONSTANT HREF", href);
          links.push({
            type: "url",
            value: rstMatches[1],
            href,
          });
        } else {
          links.push({
            type: "url",
            value: rstMatches[1],
            href: rstMatches[1],
          });
        }
      } else if (
        roleMatches &&
        roleMatches.length === 3 &&
        roleMap[roleMatches[1]] &&
        roleMap[roleMatches[1]].type &&
        roleMap[roleMatches[1]].type.link
      ) {
        let href: string = roleMap[roleMatches[1]].type.link.replace(
          "%s",
          roleMatches[2],
        );
        links.push({
          type: "url",
          value: roleMatches[0],
          href,
        });
        let doubleSlashMatches = href.match(/https?:\/\/.*(\/\/).*/);
        if (doubleSlashMatches && doubleSlashMatches.length === 2) {
          reportError(
            createError(
              new Error(`It looks like you've added an extra '/'.
URL: ${href}`),
              document,
              idx,
              line.indexOf(roleMatches[0]),
              { type: "url", value: roleMatches[0], href },
            ),
            gDC,
            context,
          );
        }
      } else if (refMatches) {
        if (!refMap[refMatches[1]]) {
          reportError(
            createError(
              new Error("Ref not found. Local refs are currently unsupported"),
              document,
              idx,
              line.indexOf(refMatches[0]),
              { type: "url", value: refMatches[0], href: "" },
            ),
            gDC,
            context,
          );
        } else {
          reportError(
            createError(
              new Error(`ref resolved: ${refMap[refMatches[1]]}`),
              document,
              idx,
              line.indexOf(refMatches[1]),
              {
                type: "url",
                value: refMatches[0],
                href: refMap[refMatches[1]],
              },
            ),
            gDC,
            context,
          );
          links.push({
            type: "url",
            value: refMatches[1],
            href: refMap[refMatches[1]],
          });
        }
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
                reportError(linkError, gDC, context);
              });
          } else {
            getURL(link)
              .then((response) => {
                let status = response.status;
                if (status !== 200) {
                  throw new Error(
                    `${link.value} with a url of ${
                      link.href
                    } failed with ${status.toString()}`,
                  );
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
                reportError(linkError, gDC, context);
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
            gDC,
            context,
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
const reportError = (
  linkError: LinkError,
  gDC: vscode.DiagnosticCollection,
  context: vscode.ExtensionContext,
) => {
  let severity;
  if (linkError.e.message.includes("Request failed with status code 301")) {
    severity = vscode.DiagnosticSeverity.Information;
    linkError.e.message = "301 redirect";
  } else if (
    linkError.e.message.includes("It looks like you've added an extra '/'")
  ) {
    severity = vscode.DiagnosticSeverity.Warning;
  } else if (linkError.e.message === "stale repository") {
    severity = vscode.DiagnosticSeverity.Warning;
  } else if (linkError.e.message.includes("Ref not found")) {
    severity = vscode.DiagnosticSeverity.Warning;
  } else if (linkError.e.message.includes("ref resolved:")) {
    linkError.e.message = linkError.e.message.slice("ref resolved: ".length);
    severity = vscode.DiagnosticSeverity.Information;
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
  context.subscriptions.push(gDC);
};
const getURL = (
  link: linkify.FindResultHash,
  options: AxiosRequestConfig = {},
) => {
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
    .get(link.href, { cancelToken: abort.token, ...options })
    .then((res) => {
      clearTimeout(id);
      return res;
    })
    .catch((e) => {
      throw new Error(
        `${link.value} failed.
URL: ${link.href}
${e.toString()}`,
      );
    });
};
