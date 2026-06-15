import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseVersionTag } from "./lib/semver-version.mjs";

const raw = process.argv[2] ?? process.env.VERSION ?? "";
const parsed = parseVersionTag(raw);

if (!parsed.ok) {
  console.error(`Invalid version "${raw}" (expected vX.Y.Z semver tag)`);
  process.exit(1);
}

const version = parsed.version;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function updateJson(filePath, mutator) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  mutator(data);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

updateJson(path.join(root, "apps/studio/src-tauri/tauri.conf.json"), (data) => {
  data.version = version;
});

updateJson(path.join(root, "apps/studio/package.json"), (data) => {
  data.version = version;
});

const cargoPath = path.join(root, "apps/studio/src-tauri/Cargo.toml");
const cargo = fs
  .readFileSync(cargoPath, "utf8")
  .replace(/^version = ".*"$/m, `version = "${version}"`);
fs.writeFileSync(cargoPath, cargo);

console.log(`Set Studio version to ${version}`);
