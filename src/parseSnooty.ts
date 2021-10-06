import { JsonMap, parse } from "@iarna/toml";
import { readFile } from "fs";

export async function readSnootyToml(): Promise<any> {
  return new Promise((resolve, reject) => {
    readFile("snooty.toml", (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(parse(data.toString()));
      }
    });
  });
}
