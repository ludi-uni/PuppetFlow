import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("pre-push: running lint and format checks...");

execSync("pnpm lint", { cwd: root, stdio: "inherit" });
execSync("pnpm format:check", { cwd: root, stdio: "inherit" });

console.log("pre-push: checks passed.");
