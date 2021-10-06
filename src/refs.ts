import { inflate } from "zlib";
import axios from "axios";

/**
 * inv file format:
 * name role priority url display
 * name is the ref name to use (i.e :ref:`foo <name>`)
 * role will be ignored
 * priority will be ignored
 * url is the url to the ref target
 * display will be ignored
 */

type refMap = { [key: string]: any };
export async function populateRefs(
  url: string,
  referenceMap: refMap = {},
): Promise<refMap> {
  let refs = await fetchInvFile(url);
  let source = url.slice(0, url.indexOf("objects.inv"));
  return refs.split("\n").reduce((acc, line) => {
    let [name, _role, _priority, url, ..._display] = line.split(" ");
    if (!name) {
      return acc;
    }
    acc[name] = source + url;
    return acc;
  }, referenceMap);
}

async function fetchInvFile(url: string): Promise<string> {
  let res = await axios.get(url, { responseType: "arraybuffer" });
  return await inflateInvFile(res.data);
}

async function inflateInvFile(buff: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    let markerLine = "The remainder of this file is compressed using zlib.\n";
    let zlibBegin = buff.indexOf(markerLine) + markerLine.length;

    inflate(buff.slice(zlibBegin), (err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data.toString("utf-8"));
    });
  });
}
