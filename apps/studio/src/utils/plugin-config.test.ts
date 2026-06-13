import { describe, expect, it } from "vitest";
import {
  isPluginEnabled,
  parseBehaviorPluginEntries,
  setPluginEnabled,
  updatePluginParameter,
} from "./plugin-config";

describe("plugin-config", () => {
  it("parses and normalizes plugin config", () => {
    const entries = parseBehaviorPluginEntries(
      JSON.stringify([{ id: "gaze", config: { wanderAmplitude: 0.04, speed: 99 } }]),
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.config.wanderAmplitude).toBe(0.04);
    expect(entries[0]?.config.speed).toBe(1);
  });

  it("enables and disables plugins", () => {
    const enabled = setPluginEnabled("[]", "blink", true);
    expect(isPluginEnabled(enabled, "blink")).toBe(true);

    const disabled = setPluginEnabled(enabled, "blink", false);
    expect(isPluginEnabled(disabled, "blink")).toBe(false);
  });

  it("updates a plugin parameter", () => {
    const json = setPluginEnabled("[]", "blink", true);
    const updated = updatePluginParameter(json, "blink", "blinkStrength", 0.22);

    const entries = parseBehaviorPluginEntries(updated);
    expect(entries[0]?.config.blinkStrength).toBe(0.22);
  });
});
