import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import {
  isBenignTauriDevExit,
  isBenignTauriDevSignal,
} from "./lib/tauri-dev-exit.mjs";

const strictMode =
  process.env.TAURI_DEV_STRICT === "1" || process.env.TAURI_DEV_STRICT === "true";

const appDir = process.cwd();
const require = createRequire(path.join(appDir, "package.json"));
const tauriCli = require.resolve("@tauri-apps/cli/tauri.js");

const child = spawn(process.execPath, [tauriCli, "dev"], {
  cwd: appDir,
  stdio: "inherit",
});

let finished = false;

function finish(code, signal) {
  if (finished) {
    return;
  }
  finished = true;

  if (signal) {
    if (strictMode && !isBenignTauriDevSignal(signal)) {
      process.exit(1);
      return;
    }
    process.exit(0);
    return;
  }

  if (strictMode) {
    process.exit(code === 0 ? 0 : (code ?? 1));
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
