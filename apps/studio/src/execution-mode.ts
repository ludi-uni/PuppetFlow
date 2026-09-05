export type StudioExecutionMode = "local" | "shared";

export interface SharedHostConfig {
  baseUrl: string;
  token: string;
}

/** The mode is fixed at launch; shared mode must never fall back to a local Runtime. */
export function getStudioExecutionMode(): StudioExecutionMode {
  return import.meta.env.VITE_PUPPETFLOW_EXECUTION_MODE === "shared"
    ? "shared"
    : "local";
}

export function getSharedHostEndpoint(): string | null {
  const baseUrl = import.meta.env.VITE_PUPPETFLOW_CONTROL_URL?.trim();
  if (!baseUrl) return null;
  if (baseUrl.replace(/\/$/, "") !== "http://127.0.0.1:8788") {
    throw new Error("Tauri shared mode requires http://127.0.0.1:8788");
  }
  return baseUrl;
}
