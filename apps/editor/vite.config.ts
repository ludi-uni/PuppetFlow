import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createPuppetflowAliases } from "../../tooling/vite-puppetflow-aliases";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: createPuppetflowAliases(),
  },
  server: {
    port: 1421,
    strictPort: true,
  },
});
