import { Uri, workspace } from "vscode";
import { promises as fs } from "fs";
import { join, extname } from "path";

export async function getLocalRefs() {
  console.log("Getting local refs");
  let refs = new Map<string, Uri>();
  workspace.workspaceFolders?.forEach(async (folder) => {
    const dirContents = await fs.readdir(folder.uri.fsPath);
    console.log("dirContents", dirContents);
    if (dirContents.includes("snooty.toml")) {
      crawl(join(folder.uri.fsPath, "source"), refs);
    }
  });
}

async function crawl(path: string, refs: Map<string, Uri>) {
  const dirContents = await fs.readdir(path);
  dirContents.forEach(async (file) => {
    const filePath = join(path, file);
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      crawl(filePath, refs);
    } else if ([".txt", ".rst"].includes(extname(filePath))) {
      extractRefs(filePath);
    }
  });
}

async function extractRefs(path: string) {
  const file = await fs.readFile(path, "utf8");
  const regex = /\.\.\s_(.*):/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(file)) !== null) {
    console.log(match);
  }
}
