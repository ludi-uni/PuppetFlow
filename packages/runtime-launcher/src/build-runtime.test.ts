import { describe, expect, it } from "vitest";

import { buildRuntime } from "./node.js";
import { getPresetJson } from "@puppetflow/behavior-packs";

describe("buildRuntime", () => {
  it("builds a runtime with default node adapters", () => {
    const runtime = buildRuntime({
      presetJson: getPresetJson("Curious"),
    });

    expect(runtime.getPlugins().length).toBeGreaterThan(0);
    expect(runtime.getAdapters().length).toBeGreaterThan(0);
  });

  it("attaches configured sources", () => {
    const runtime = buildRuntime({
      presetJson: getPresetJson("Idle"),
      sources: {
        httpUrl: "http://localhost:3000/input",
        wsUrl: "ws://localhost:8080/input",
      },
      adapters: {
        vmc: { enabled: true },
        logger: { enabled: false },
      },
    });

    expect(runtime.getAdapters()).toHaveLength(1);
  });
});
