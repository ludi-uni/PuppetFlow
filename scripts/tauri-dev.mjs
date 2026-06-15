import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const appDir = process.cwd();
const require = createRequire(path.join(appDir, "package.json"));
const tauriCli = require.resolve("@tauri-apps/cli/tauri.js");

const child = spawn(process.execPath, [tauriCli, "dev"], {
  cwd: appDir,
  stdio: "inherit",
});

let finished = false;

function isBenignTauriDevExit(code) {
  if (code === null || code === 0) {
    return true;
  }
  // Windows: UINT32 representation of -1 when the Tauri window is closed in dev.
  if (code === 4294967295) {
    return true;
  }
  const signed = code | 0;
  // -1 / 255 on Windows; 130 (SIGINT) and 143 (SIGTERM) are common on Linux/macOS dev teardown.
  return signed === -1 || signed === 255 || signed === 130 || signed === 143;
}

function finish(code, signal) {
  if (finished) {
    return;
  }
  finished = true;

  if (signal) {
    process.exit(0);
    return;
  }

  process.exit(isBenignTauriDevExit(code) ? 0 : (code ?? 1));
}

child.on("close", finish);
child.on("exit", finish);

child.on("error", (error) => {
  console.error(error);
  finish(1, null);
});
