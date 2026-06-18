import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const workspacePackages = [
  "adapter-core",
  "behavior",
  "adapter-logger",
  "adapter-live2d",
  "adapter-vmc",
  "adapter-vrm",
  "adapter-websocket",
  "core",
  "modifier",
  "modifier-core",
  "motion-graph",
  "motion-mapper",
  "micro-behavior",
  "plugin-attention",
  "plugin-blink",
  "plugin-emotion",
  "plugin-gaze",
  "plugin-idle",
  "plugin-rule",
  "preset",
  "runtime",
  "source-core",
  "source-discord",
  "source-http",
  "source-mqtt",
  "source-websocket",
] as const;

export function createPuppetflowAliases(): Record<string, string> {
  return Object.fromEntries(
    workspacePackages.map((pkg) => [
      `@puppetflow/${pkg}`,
      path.join(workspaceRoot, "packages", pkg, "src/index.ts"),
    ]),
  );
}
