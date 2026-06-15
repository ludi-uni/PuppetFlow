import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundleCli } from "./lib/cli-bundle.mjs";
import { detectSeaSentinel } from "./lib/cli-sea.mjs";

const [label, versionArg, outputDirArg] = process.argv.slice(2);

if (!label || !versionArg || !outputDirArg) {
  console.error(
    "Usage: node scripts/package-portable-cli.mjs <label> <version> <output-dir>",
  );
  process.exit(1);
}

const version = versionArg.replace(/^v/, "");
const outputDir = path.resolve(outputDirArg);
const zipPath = path.join(outputDir, `pf-cli-${label}-${version}-portable.zip`);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pf-cli-portable-"));
const bundlePath = path.join(tempDir, "pf-bundle.cjs");
const seaConfigPath = path.join(tempDir, "sea-config.json");
const seaBlobPath = path.join(tempDir, "sea-prep.blob");
const executableName = process.platform === "win32" ? "pf.exe" : "pf";
const executablePath = path.join(tempDir, executableName);

fs.mkdirSync(outputDir, { recursive: true });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveNodeBinary() {
  const nodeExecPath = process.execPath;
  if (!nodeExecPath) {
    throw new Error("Unable to resolve Node.js executable path");
  }
  return nodeExecPath;
}

async function main() {
  await bundleCli({ outfile: bundlePath });

  fs.writeFileSync(
    seaConfigPath,
    `${JSON.stringify(
      {
        main: bundlePath,
        output: seaBlobPath,
        disableExperimentalSEAWarning: true,
        useSnapshot: false,
        useCodeCache: true,
      },
      null,
      2,
    )}\n`,
  );

  run(process.execPath, ["--experimental-sea-config", seaConfigPath]);

  fs.copyFileSync(resolveNodeBinary(), executablePath);
  if (process.platform !== "win32") {
    fs.chmodSync(executablePath, 0o755);
  }

  const seaSentinel = detectSeaSentinel(executablePath);
  const postjectArgs = [
    executablePath,
    "NODE_SEA_BLOB",
    seaBlobPath,
    "--sentinel-fuse",
    seaSentinel,
  ];
  if (process.platform === "darwin") {
    postjectArgs.push("--macho-segment-name", "NODE_SE");
  }

  run("npx", ["--yes", "postject@1.0.0-alpha.6", ...postjectArgs], {
    shell: process.platform === "win32",
  });

  if (process.platform === "darwin") {
    run("codesign", ["--sign", "-", executablePath]);
  }

  const readmePath = path.join(tempDir, "README.txt");
  fs.writeFileSync(
    readmePath,
    [
      "PuppetFlow CLI (portable)",
      "",
      "Run:",
      process.platform === "win32"
        ? "  pf.exe run --preset Curious"
        : "  ./pf run --preset Curious",
      "",
      "Built-in presets: Curious, Happy, Idle, Thinking, Sleepy, Focused",
      "Docs: https://github.com/ludi-uni/PuppetFlow/blob/main/docs/guides/cli.md",
      "",
    ].join("\n"),
    "utf8",
  );

  if (process.platform === "win32") {
    run(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -Path '${tempDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
      ],
      { shell: true },
    );
  } else {
    run("zip", ["-r", zipPath, executableName, "README.txt"], { cwd: tempDir });
  }

  if (!fs.existsSync(zipPath)) {
    console.error(`Portable CLI archive was not created: ${zipPath}`);
    process.exit(1);
  }

  console.log(zipPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
