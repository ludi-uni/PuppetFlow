import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { shutdownRuntime } from "./runtime";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (
  typeof globalThis !== "undefined" &&
  Boolean((globalThis as { isTauri?: boolean }).isTauri)
) {
  window.addEventListener("pagehide", () => {
    void shutdownRuntime();
  });
}
