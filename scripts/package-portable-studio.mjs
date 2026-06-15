import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  copyDirectory,
  findMacAppBundle,
  portableZipName,
  resolveStudioTargetRoot,
  stageWindowsLinuxPortable,
} from "./lib/release-assets.mjs";

const [platform, label, versionArg, outputDirArg] = process.argv.slice(2);
const BINARY_NAME = "puppetflow-studio";

if (!platform || !label || !versionArg || !outputDirArg) {
  console.error(
    "Usage: node scripts/package-portable-studio.mjs <windows|linux|macos> <label> <version> <output-dir>",
  );
  process.exit(1);
}

const version = versionArg.replace(/^v/, "");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.resolve(outputDirArg);
const targetRoot = resolveStudioTargetRoot(platform, repoRoot);
const zipPath = path.join(outputDir, portableZipName(label, version));

fs.mkdirSync(outputDir, { recursive: true });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (platform === "macos") {
  const appBundle = findMacAppBundle(path.join(targetRoot, "release/bundle/macos"));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pf-studio-portable-"));
  const stagedApp = path.join(tempDir, path.basename(appBundle));
  copyDirectory(appBundle, stagedApp);

  run("zip", ["-r", zipPath, path.basename(stagedApp)], { cwd: tempDir });
  fs.rmSync(tempDir, { recursive: true, force: true });
} else {
  const releaseDir = path.join(targetRoot, "release");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pf-studio-portable-"));
  const stageDir = path.join(tempDir, "PuppetFlow Studio");
  stageWindowsLinuxPortable(releaseDir, stageDir, BINARY_NAME);

  const stagedEntries = fs.readdirSync(stageDir);
  if (stagedEntries.length === 0) {
    console.error(`No portable files staged from ${releaseDir}`);
    process.exit(1);
  }

  if (process.platform === "win32") {
    run(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path '${stageDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
      ],
      { shell: true },
    );
  } else {
    run("zip", ["-r", zipPath, path.basename(stageDir)], { cwd: tempDir });
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
}

if (!fs.existsSync(zipPath)) {
  console.error(`Portable archive was not created: ${zipPath}`);
  process.exit(1);
}

console.log(zipPath);
