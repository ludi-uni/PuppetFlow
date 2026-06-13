import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createPuppetflowAliases } from "../../tooling/vite-puppetflow-aliases";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: createPuppetflowAliases(),
  },
  clearScreen: false,
  server: {
    port: 1422,
    strictPort: true,
    host: host ?? false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1423,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/blockly")) {
            return "blockly";
          }
          if (id.includes("node_modules/@xyflow")) {
            return "xyflow";
          }
        },
      },
    },
  },
});
