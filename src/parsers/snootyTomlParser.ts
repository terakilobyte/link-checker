import { JsonMap, parse } from "@iarna/toml";
import { promises as fs } from "fs";
import { join } from "path";
import { workspace } from "vscode";

let snootyToml: JsonMap;

export default async function readSnootyToml(): Promise<any> {
  if (snootyToml) {
    return snootyToml;
  }
  for (let folder of workspace.workspaceFolders || []) {
    const dirContents = await fs.readdir(folder.uri.fsPath);
    if (dirContents.includes("snooty.toml")) {
      try {
        let snooty = await fs.readFile(
          join(folder.uri.path, "snooty.toml"),
          "utf8",
        );
        snootyToml = parse(snooty);
        return snootyToml;
      } catch (e) {
        console.error("Error finding snooty.toml file", e);
      }
    }
  }
}
