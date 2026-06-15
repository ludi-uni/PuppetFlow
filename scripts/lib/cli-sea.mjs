import fs from "node:fs";

export function detectSeaSentinel(nodeBinaryPath) {
  const contents = fs.readFileSync(nodeBinaryPath);
  const text = contents.toString("latin1");
  const match = text.match(/NODE_SEA_FUSE_[a-f0-9]{32}/);
  if (!match) {
    throw new Error(`Unable to detect NODE_SEA_FUSE sentinel in ${nodeBinaryPath}`);
  }
  return match[0];
}
