/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  getDefaultTab,
  getTabsForMode,
  normalizeTabForMode,
} from "../constants/studio-mode";
import {
  loadPersistedTab,
  resetStudioPersistedConfigForTests,
  savePersistedStudioMode,
  savePersistedTab,
} from "../utils/studio-config-storage";
import { useStudioMode } from "./useStudioMode";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("useStudioMode helpers", () => {
  it("normalizes expert-only tabs to simple equivalents", () => {
    expect(normalizeTabForMode("graph", "simple")).toBe("mapping");
    expect(normalizeTabForMode("sources", "simple")).toBe("presets");
    expect(normalizeTabForMode("pipeline", "simple")).toBe("pipeline");
  });

  it("keeps expert tabs visible in expert mode", () => {
    expect(normalizeTabForMode("pfscript", "expert")).toBe("pfscript");
    expect(normalizeTabForMode("graph", "expert")).toBe("graph");
  });

  it("lists different tab sets per mode", () => {
    const simpleIds = getTabsForMode("simple").map((tab) => tab.id);
    const expertIds = getTabsForMode("expert").map((tab) => tab.id);

    expect(simpleIds.slice(0, 3)).toEqual(["presets", "acting", "mapper"]);
    expect(simpleIds).toContain("mapping");
    expect(simpleIds).not.toContain("pfscript");
    expect(simpleIds).not.toContain("scratch");
    expect(expertIds).toContain("pfscript");
    expect(expertIds).toContain("sources");
    expect(expertIds).not.toContain("scratch");
    expect(getTabsForMode("expert", true).map((tab) => tab.id)).toContain("scratch");
  });

  it("uses Preset as the new Simple default and safely rejects disabled Blockly", () => {
    expect(getDefaultTab("simple")).toBe("presets");
    expect(normalizeTabForMode("scratch", "expert", false)).toBe("pipeline");
    expect(normalizeTabForMode("scratch", "expert", true)).toBe("scratch");
  });

  it("migrates a saved Scratch selection to a visible tab without enabling Blockly", () => {
    resetStudioPersistedConfigForTests();
    savePersistedStudioMode("expert");
    savePersistedTab("expert", "scratch");
    const container = document.createElement("div");
    const root = createRoot(container);

    function Probe() {
      const { tab, blocklyEnabled } = useStudioMode();
      return createElement("span", null, `${tab}:${String(blocklyEnabled)}`);
    }

    act(() => root.render(createElement(Probe)));

    expect(container.textContent).toBe("pipeline:false");
    expect(loadPersistedTab("expert")).toBe("pipeline");

    act(() => root.unmount());
    resetStudioPersistedConfigForTests();
  });
});
