import { Uri } from "vscode";
import { LinkFindResult } from "./linkCheck";

export type LinkError = {
  e: Error;
  uri: Uri;
  link: LinkFindResult;
};
export enum LinkStatus {
  PENDING,
  OK,
  NOTOK,
}
export type LinkResult = {
  linkStatus: LinkStatus | undefined;
  linkError: LinkError | undefined;
};
