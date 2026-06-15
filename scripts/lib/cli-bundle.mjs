import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const entryPoint = path.join(repoRoot, "apps/cli/src/cli.ts");

export async function bundleCli({ outfile }) {
  await esbuild.build({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    sourcemap: false,
    minify: false,
    logLevel: "info",
    loader: {
      ".pfpreset": "text",
    },
    banner: {
      js: "/* PuppetFlow CLI bundle */",
    },
  });
}
