import { LinkResult } from "./linkStates";
import { clearErrors } from "./utils";
import { ILCProvider } from "./providers/ILCProvider";
import {
  Range,
  DocumentLinkProvider,
  TextDocument,
  CancellationToken,
  ProviderResult,
  DocumentLink,
  window,
  DiagnosticCollection,
  ExtensionContext,
  Diagnostic,
} from "vscode";

export interface LinkFindResult {
  href: string;
  value: string;
  range: Range;
}

let seenUrls = new Map<string, LinkResult>();

export default class LinkChecker implements DocumentLinkProvider {
  private providers: ILCProvider[] = [];
  public provideDocumentLinks(
    document: TextDocument,
    _token: CancellationToken,
  ): ProviderResult<DocumentLink[]> {
    const links = this.providers.reduce((links, provider) => {
      return [...links, ...provider.provideDocumentLinks(document)];
    }, Array<DocumentLink>());
    return links;
  }
  public registerLCProvider(provider: ILCProvider) {
    this.providers.push(provider);
  }
  public checkLinks(
    document = window.activeTextEditor?.document,
    gDC: DiagnosticCollection,
    context: ExtensionContext,
    supportedLanguages: string[],
  ) {
    if (!document || !supportedLanguages.includes(document?.languageId)) {
      return;
    }
    if (document === undefined) {
      return;
    }
    clearErrors(gDC, document?.uri);
    let gDA = Array<Diagnostic>();
    this.providers.forEach((provider) => {
      provider.checkLinks(seenUrls, document, gDC, gDA, context);
    });
  }
}
