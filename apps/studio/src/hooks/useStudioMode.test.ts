import { describe, expect, it } from "vitest";
import { getTabsForMode, normalizeTabForMode } from "../constants/studio-mode";

describe("useStudioMode helpers", () => {
  it("normalizes expert-only tabs to simple equivalents", () => {
    expect(normalizeTabForMode("graph", "simple")).toBe("mapping");
    expect(normalizeTabForMode("sources", "simple")).toBe("pipeline");
    expect(normalizeTabForMode("pipeline", "simple")).toBe("pipeline");
  });

  it("keeps expert tabs visible in expert mode", () => {
    expect(normalizeTabForMode("pfscript", "expert")).toBe("pfscript");
    expect(normalizeTabForMode("graph", "expert")).toBe("graph");
  });

  it("lists different tab sets per mode", () => {
    const simpleIds = getTabsForMode("simple").map((tab) => tab.id);
    const expertIds = getTabsForMode("expert").map((tab) => tab.id);

    expect(simpleIds).toContain("mapping");
    expect(simpleIds).not.toContain("pfscript");
    expect(expertIds).toContain("pfscript");
    expect(expertIds).toContain("sources");
  });
});
