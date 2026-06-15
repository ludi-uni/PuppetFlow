import { compilePfScript } from "@puppetflow/pfscript-core";
import { describe, expect, it } from "vitest";
import {
  compilePresetBehavior,
  materializePresetBehavior,
} from "./compile-behavior.js";

describe("materializePresetBehavior", () => {
  it("recompiles behavior cache from behaviorPfScript", () => {
    const source = "mouthY = volume\nbreath = breath(0.1)";
    const stale = compilePfScript("mouthX = 1");
    const materialized = materializePresetBehavior({
      name: "Test",
      version: 3,
      behaviorPfScript: source,
      behavior: stale,
      graph: { nodes: [], edges: [] },
    });

    const compiled = compilePresetBehavior(materialized);
    expect(compiled.behaviorPfScript).toBe(source);
    expect(compiled.behavior.statements.length).toBeGreaterThan(0);
    expect(JSON.stringify(materialized.behavior)).not.toEqual(JSON.stringify(stale));
  });
});
