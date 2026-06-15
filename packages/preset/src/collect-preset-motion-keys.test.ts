import { compilePfScript } from "@puppetflow/pfscript-core";
import { describe, expect, it } from "vitest";
import {
  collectBehaviorCustomMotionKeys,
  collectBehaviorMotionKeys,
  collectPresetMotionKeys,
  detectPresetMotionOverlaps,
  formatBehaviorMotionKey,
} from "./collect-preset-motion-keys.js";

describe("collect-preset-motion-keys", () => {
  it("collects standard keys from ExprAssign", () => {
    const behavior = compilePfScript(`
bodyLean = 0.5 + oscillator(id = "body", frequency = 0.2) * 0.1
mouthY = volume
`);

    expect(collectBehaviorMotionKeys(behavior)).toEqual(["bodyLean", "mouthY"]);
  });

  it("collects custom keys from ExprAssign targets", () => {
    const behavior = compilePfScript(`
breath = breath(0.1)
if currentPhoneme == "A" then
    MouthA = 1
end
`);

    expect(collectBehaviorMotionKeys(behavior)).toContain("custom:breath");
    expect(collectBehaviorMotionKeys(behavior)).toContain("custom:MouthA");
    expect(collectBehaviorCustomMotionKeys(behavior)).toEqual(["MouthA", "breath"]);
  });

  it("formats custom assign targets", () => {
    expect(formatBehaviorMotionKey("custom:breath")).toBe("custom:breath");
    expect(formatBehaviorMotionKey("mouthX")).toBe("mouthX");
  });

  it("collectPresetMotionKeys lists sources per stage", () => {
    const behavior = compilePfScript("mouthY = volume");
    const keys = collectPresetMotionKeys({
      behavior,
      graph: {
        nodes: [
          {
            id: "out",
            type: "output",
            data: { key: "mouthX" },
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
      },
      behaviorPlugins: [{ id: "blink" }],
    });

    expect(keys.find((entry) => entry.motionKey === "mouthY")).toEqual({
      motionKey: "mouthY",
      sources: ["behavior"],
    });
    expect(keys.find((entry) => entry.motionKey === "mouthX")).toEqual({
      motionKey: "mouthX",
      sources: ["graph"],
    });
    expect(keys.find((entry) => entry.motionKey === "eyeYaw")).toEqual({
      motionKey: "eyeYaw",
      sources: ["plugin:blink"],
    });
  });

  it("detectPresetMotionOverlaps warns on graph+behavior mouthX", () => {
    const behavior = compilePfScript("mouthX = interest * 0.5");
    const overlaps = detectPresetMotionOverlaps({
      behavior,
      graph: {
        nodes: [
          {
            id: "out",
            type: "output",
            data: { key: "mouthX" },
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
      },
    });

    expect(overlaps).toEqual([{ motionKey: "mouthX", sources: ["graph", "behavior"] }]);
  });

  it("detectPresetMotionOverlaps warns when multiple plugins share lookX", () => {
    const overlaps = detectPresetMotionOverlaps({
      behavior: { type: "Block", statements: [] },
      graph: { nodes: [], edges: [] },
      behaviorPlugins: [{ id: "gaze" }, { id: "idle" }],
    });

    expect(overlaps).toEqual([
      { motionKey: "lookX", sources: ["plugin:gaze", "plugin:idle"] },
      { motionKey: "lookY", sources: ["plugin:gaze", "plugin:idle"] },
    ]);
  });
});
