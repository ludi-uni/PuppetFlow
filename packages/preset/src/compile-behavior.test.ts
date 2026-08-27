import { compilePfScript } from "@puppetflow/pfscript-core";
import { describe, expect, it } from "vitest";
import {
  compilePresetBehavior,
  materializePresetBehavior,
} from "./compile-behavior.js";

describe("materializePresetBehavior", () => {
  it("recompiles behavior cache from behaviorPfScript", () => {
    const source = "let intensity = interest * 0.5\nthinking(intensity = intensity)";
    const stale = compilePfScript("mouthX = 1");
    const materialized = materializePresetBehavior({
      name: "Test",
      version: 3,
      behaviorPfScript: source,
      behavior: stale,
      graph: { nodes: [], edges: [] },
    });

    const compiled = compilePresetBehavior(materialized);
    const parsedCache = compilePresetBehavior({ behavior: materialized.behavior });
    expect(compiled.behaviorPfScript).toBe(source);
    expect(compiled.behavior.statements.length).toBeGreaterThan(0);
    expect(parsedCache.behavior.statements[0]).toMatchObject({ type: "LocalLet" });
    expect(parsedCache.behavior.statements[1]).toMatchObject({
      type: "MotionPack",
      configExpressions: { intensity: { type: "Identifier", name: "intensity" } },
    });
    expect(JSON.stringify(materialized.behavior)).not.toEqual(JSON.stringify(stale));
  });
});
