import { parse } from "@iarna/toml";
import axios from "axios";
import { workspace } from "vscode";

const owner = "mongodb";
const repo = "snooty-parser";
const path = "snooty/rstspec.toml";

export const populateRoleMap = async () => {
  let apiToken = workspace
    .getConfiguration("linkChecker")
    .get("linkCheckerToken");
  let authorizationHeader = {};
  if (apiToken) {
    authorizationHeader = {
      authorization: `Bearer ${apiToken}`,
    };
  }
  const res = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/releases?per_page=1`,
  );
  const ref = res.data[0].tag_name;
  const content = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?${ref}`,
  );

  const toml = parse(
    Buffer.from(content.data.content, "base64").toString("utf8"),
  ) as { [key: string]: any };
  let roles = Object.keys(toml.role)
    .filter((key) => typeof toml.role[key]["type"] === "object")
    .reduce((acc: { [key: string]: any }, key: string) => {
      if (typeof toml.role[key]["type"]["link"] === "string") {
        acc[key] = toml.role[key]["type"]["link"];
      }
      return acc;
    }, {});
  return roles;
};
