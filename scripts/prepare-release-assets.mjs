import path from "node:path";
import { copyReleaseAssets } from "./lib/release-assets.mjs";

const sourceDir = process.argv[2];
const outputDir = process.argv[3];

if (!sourceDir || !outputDir) {
  console.error(
    "Usage: node scripts/prepare-release-assets.mjs <artifacts-dir> <release-dir>",
  );
  process.exit(1);
}

const copied = copyReleaseAssets(path.resolve(sourceDir), path.resolve(outputDir));

if (copied.length === 0) {
  console.error(`No release assets found under ${sourceDir}`);
  process.exit(1);
}

for (const filePath of copied) {
  console.log(filePath);
}
