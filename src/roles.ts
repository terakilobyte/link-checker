import { parse } from "@iarna/toml";

const owner = "mongodb";
const repo = "snooty-parser";
const path = "snooty/rstspec.toml";

export const populateRoleMap = async (ghClient: any) => {
  const res = await ghClient.repos.listReleases({ owner, repo, per_page: 1 });
  const ref = res.data[0].tag_name;
  const content = await ghClient.request(
    "GET /repos/{owner}/{repo}/contents/{path}?{ref}",
    {
      owner,
      repo,
      path,
      ref,
    },
  );
  const toml = parse(
    Buffer.from(content.data.content, "base64").toString("utf8"),
  );
  return toml.role;
};
