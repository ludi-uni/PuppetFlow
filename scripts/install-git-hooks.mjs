import { chmodSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hooksDir = path.join(root, ".githooks");
const prePushHook = path.join(hooksDir, "pre-push");

function isGitRepository() {
  try {
    execSync("git rev-parse --git-dir", { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (!isGitRepository()) {
  process.exit(0);
}

execSync("git config core.hooksPath .githooks", { cwd: root, stdio: "inherit" });

if (existsSync(prePushHook)) {
  try {
    chmodSync(prePushHook, 0o755);
  } catch {
    // Windows may ignore chmod; Git for Windows still runs the hook via sh.
  }
}

console.log("Installed git hooks from .githooks (pre-push: lint + format:check)");
