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

export default async function fetchInvFile(url: string): Promise<string> {
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
