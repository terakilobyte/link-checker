import { JsonMap, parse } from "@iarna/toml";
import { readFile } from "fs";

let snootyToml: JsonMap;

export default async function readSnootyToml(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!snootyToml) {
      readFile("snooty.toml", (err, data) => {
        if (err) {
          reject(err);
        } else {
          snootyToml = parse(data.toString());
          resolve(snootyToml);
        }
      });
    } else {
      resolve(snootyToml);
    }
  });
}
