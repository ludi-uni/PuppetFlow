import { describe, expect, it } from "vitest";
import {
  isBenignTauriDevExit,
  isBenignTauriDevSignal,
} from "./lib/tauri-dev-exit.mjs";

describe("tauri-dev exit codes", () => {
  it("normalizes benign dev teardown codes by default", () => {
    expect(isBenignTauriDevExit(0)).toBe(true);
    expect(isBenignTauriDevExit(4294967295)).toBe(true);
    expect(isBenignTauriDevExit(-1)).toBe(true);
    expect(isBenignTauriDevExit(130)).toBe(true);
    expect(isBenignTauriDevExit(1)).toBe(false);
  });

  it("treats only success as benign in strict mode", () => {
    expect(isBenignTauriDevExit(0, true)).toBe(true);
    expect(isBenignTauriDevExit(4294967295, true)).toBe(false);
    expect(isBenignTauriDevExit(-1, true)).toBe(false);
    expect(isBenignTauriDevExit(130, true)).toBe(false);
    expect(isBenignTauriDevExit(1, true)).toBe(false);
  });

  it("allows SIGINT and SIGTERM as benign signals", () => {
    expect(isBenignTauriDevSignal("SIGINT")).toBe(true);
    expect(isBenignTauriDevSignal("SIGTERM")).toBe(true);
    expect(isBenignTauriDevSignal("SIGKILL")).toBe(false);
  });
});
