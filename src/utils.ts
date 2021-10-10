import axios, { AxiosRequestConfig } from "axios";
import { LinkError, LinkResult, LinkStatus } from "./linkStates";
import { LinkFindResult } from "./linkCheck";
import {
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  ExtensionContext,
  Uri,
  workspace,
} from "vscode";

export const createError = (
  e: Error,
  uri: Uri,
  link: LinkFindResult,
): LinkError => {
  return {
    e,
    uri,
    link,
  };
};
export const reportError = (
  linkError: LinkError,
  gDC: DiagnosticCollection,
  gDA: Diagnostic[],
  context: ExtensionContext,
) => {
  let severity;
  if (linkError.e.message.includes("Request failed with status code 301")) {
    severity = DiagnosticSeverity.Information;
    linkError.e.message = "301 redirect";
  } else if (
    linkError.e.message.includes("It looks like you've added an extra '/'")
  ) {
    severity = DiagnosticSeverity.Warning;
  } else if (linkError.e.message === "stale repository") {
    severity = DiagnosticSeverity.Warning;
  } else if (linkError.e.message.includes("Ref not found")) {
    severity = DiagnosticSeverity.Warning;
  } else if (linkError.e.message.includes("ref resolved:")) {
    linkError.e.message = linkError.e.message.slice("ref resolved: ".length);
    severity = DiagnosticSeverity.Information;
  } else {
    severity = DiagnosticSeverity.Error;
  }

  let err = new Diagnostic(linkError.link.range, linkError.e.message, severity);
  err.source = "Link Checker";
  gDA.push(err);
  gDC.set(linkError.uri, gDA);
  context.subscriptions.push(gDC);
};
export const getURL = (
  link: LinkFindResult,
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
export function clearErrors(dc: DiagnosticCollection, uri: Uri) {
  dc.delete(uri);
}

export async function getLinkStatus(
  seenUrls: Map<string, LinkResult>,
  link: LinkFindResult,
  uri: Uri,
  gDC: DiagnosticCollection,
  gDA: Diagnostic[],
  context: ExtensionContext,
) {
  let doubleSlashMatches = link.href.match(/https?:\/\/.*(\/\/).*/);
  if (doubleSlashMatches && doubleSlashMatches.length === 2) {
    reportError(
      createError(
        new Error(`It looks like you've added an extra '/'.
URL: ${link.href}`),
        uri,
        link,
      ),
      gDC,
      gDA,
      context,
    );
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

      if (owner !== "settings") {
        let apiToken = workspace
          .getConfiguration("linkChecker")
          .get("linkCheckerToken");
        let authorizationHeader = {};
        if (apiToken) {
          authorizationHeader = {
            authorization: `Bearer ${apiToken}`,
          };
        }

        return axios
          .get(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: {
              ...authorizationHeader,
              Accept: "application/vnd.github.v3+json",
            },
          })
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
            let linkError = createError(e, uri, link);
            seenUrls.set(link.href, {
              linkStatus: LinkStatus.NOTOK,
              linkError,
            });
            reportError(linkError, gDC, gDA, context);
          });
      } else {
        getRegularUrl(link, seenUrls, uri, gDC, gDA, context);
      }
    } else {
      getRegularUrl(link, seenUrls, uri, gDC, gDA, context);
    }
  } else if (seenUrls.get(link.href)?.linkStatus === LinkStatus.NOTOK) {
    reportError(
      createError(seenUrls.get(link.href)?.linkError?.e as Error, uri, link),
      gDC,
      gDA,
      context,
    );
  }
}
function getRegularUrl(
  link: LinkFindResult,
  seenUrls: Map<string, LinkResult>,
  uri: Uri,
  gDC: DiagnosticCollection,
  gDA: Diagnostic[],
  context: ExtensionContext,
) {
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
      let linkError = createError(e, uri, link);
      seenUrls.set(link.href, {
        linkStatus: LinkStatus.NOTOK,
        linkError,
      });
      reportError(linkError, gDC, gDA, context);
    });
}
