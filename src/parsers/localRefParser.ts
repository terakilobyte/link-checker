import { Uri, workspace } from "vscode";
import { promises as fs } from "fs";
import { join, extname } from "path";

let refs: { [key: string]: any };

export async function getLocalRefs() {
  if (!refs) {
    for (let folder of workspace.workspaceFolders || []) {
      const dirContents = await fs.readdir(folder.uri.fsPath);
      if (dirContents.includes("snooty.toml")) {
        refs = await crawl(join(folder.uri.fsPath, "source"));
      }
    }
  }
  return refs;
}

async function crawl(path: string): Promise<{ [key: string]: any }> {
  const dirContents = await fs.readdir(path);
  let refs: { [key: string]: any } = {};
  for (let file of dirContents) {
    if ([".txt", ".rst"].includes(extname(file))) {
      refs = { ...refs, ...(await extractRefs(join(path, file))) };
    } else if (file !== "node_modules") {
      refs = { ...refs, ...(await crawl(join(path, file))) };
    }
  }
  return refs;
}

async function extractRefs(path: string) {
  let refs: { [key: string]: any } = {};
  const file = await fs.readFile(path, "utf8");
  const regex = /^\.\.\s_(.*):$/g;
  let lines = file.split("\n");
  lines.forEach((line, index) => {
    let matches = regex.exec(line);
    if (matches) {
      refs[matches[1]] = Uri.file(`${path}`);
    }
  });
  return refs;
}
