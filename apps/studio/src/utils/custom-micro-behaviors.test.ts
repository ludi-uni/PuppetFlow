import { afterEach, describe, expect, it } from "vitest";
import {
  createCustomMicroBehaviorTemplate,
  loadCustomMicroBehaviors,
  mergeImportedCustomMicroBehaviors,
  parseCustomMicroBehaviorEditorJson,
  parseCustomMicroBehaviorsImport,
  resetCustomMicroBehaviorsStorageForTests,
  saveCustomMicroBehaviors,
  serializeCustomMicroBehaviorsForExport,
} from "./custom-micro-behaviors.js";

describe("custom-micro-behaviors", () => {
  afterEach(() => {
    resetCustomMicroBehaviorsStorageForTests();
  });

  it("persists and loads custom definitions", () => {
    const template = createCustomMicroBehaviorTemplate();
    saveCustomMicroBehaviors([template]);

    expect(loadCustomMicroBehaviors()).toEqual([template]);
  });

  it("rejects built-in behavior ids in editor json", () => {
    const result = parseCustomMicroBehaviorEditorJson(
      JSON.stringify({
        id: "look_up",
        duration: 1,
        cooldown: 0,
        keyframes: [{ t: 0, params: { lookY: 0.5 } }],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("look_up");
    }
  });

  it("imports file format and merges by id", () => {
    const template = createCustomMicroBehaviorTemplate();
    const imported = parseCustomMicroBehaviorsImport(
      serializeCustomMicroBehaviorsForExport([
        template,
        { ...template, id: "wave", duration: 2 },
      ]),
    );

    expect(imported.ok).toBe(true);
    if (imported.ok) {
      const merged = mergeImportedCustomMicroBehaviors([], imported.definitions);
      expect(merged.map((entry) => entry.id)).toEqual(["my_custom", "wave"]);
    }
  });
});
