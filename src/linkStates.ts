import { TextDocument } from "vscode";
import { FindResultHash } from "linkifyjs";

export type LinkError = {
  e: Error;
  document: TextDocument;
  idx: number;
  position: number;
  link: FindResultHash;
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
