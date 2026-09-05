export type StudioExecutionMode = "local" | "shared";

export interface SharedHostConfig {
  baseUrl: string;
  token: string;
}

function readEnv(name: string): string | undefined {
  const value = import.meta.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** The mode is fixed at launch; shared mode must never fall back to a local Runtime. */
export function getStudioExecutionMode(): StudioExecutionMode {
  return readEnv("VITE_PUPPETFLOW_EXECUTION_MODE") === "shared" ? "shared" : "local";
}

export function getSharedHostConfig(): SharedHostConfig | null {
  const baseUrl = readEnv("VITE_PUPPETFLOW_CONTROL_URL");
  const token = readEnv("VITE_PUPPETFLOW_CONTROL_TOKEN");
  if (!baseUrl || !token) return null;
  if (baseUrl.replace(/\/$/, "") !== "http://127.0.0.1:8788") {
    throw new Error("Tauri shared mode requires http://127.0.0.1:8788");
  }
  return { baseUrl, token };
}
