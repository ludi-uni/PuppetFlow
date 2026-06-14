import { PLUGIN_MOTION_OUTPUTS } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import type { BehaviorPlugin } from "@puppetflow/core";
import {
  BUILTIN_BEHAVIOR_PLUGIN_IDS,
  createBehaviorPlugin,
  registerBehaviorPlugin,
} from "./plugin-factory.js";

describe("plugin-factory", () => {
  it("creates builtin plugins", () => {
    expect(createBehaviorPlugin({ id: "gaze" }).id).toBe("gaze");
  });

  it("supports registering additional plugins", () => {
    const custom: BehaviorPlugin = { id: "custom-test", process: () => ({}) };
    registerBehaviorPlugin("custom-test", () => custom);
    expect(createBehaviorPlugin({ id: "custom-test" })).toBe(custom);
  });

  it("keeps builtin plugin ids aligned with PLUGIN_MOTION_OUTPUTS", () => {
    for (const id of BUILTIN_BEHAVIOR_PLUGIN_IDS) {
      expect(PLUGIN_MOTION_OUTPUTS[id]).toBeDefined();
      expect(createBehaviorPlugin({ id }).id).toBe(id);
    }
  });
});
