import { describe, expect, it } from "vitest";
import type { BehaviorPlugin } from "@puppetflow/core";
import {
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
});
