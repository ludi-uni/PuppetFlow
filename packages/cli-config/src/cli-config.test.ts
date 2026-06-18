import { describe, expect, it } from "vitest";

import {
  buildCliYamlFromStudio,
  mergeLaunchConfig,
  parseYamlConfig,
  serializeCliYamlConfig,
  yamlConfigToLaunchConfig,
} from "./index.js";

describe("cli-config", () => {
  it("builds yaml config from studio applied settings", () => {
    const config = buildCliYamlFromStudio({
      presetName: "Curious",
      isCustomPreset: false,
      sources: {
        httpUrl: "http://127.0.0.1:3000/input",
        wsUrl: "ws://127.0.0.1:8080/input",
      },
      mapperConfig: {
        vmc: { enabled: true, host: "127.0.0.1", port: 39539 },
        live2d: { enabled: false, host: "127.0.0.1", port: 39539 },
        vrm: { enabled: false, host: "127.0.0.1", port: 39539 },
        loggerEnabled: true,
        loggerThrottleMs: 5000,
      },
      initialState: { interest: 0.6, energy: 0.5 },
    });

    expect(config.presetName).toBe("Curious");
    expect(config.sources?.http).toBe("http://127.0.0.1:3000/input");
    expect(config.adapters?.vmc?.enabled).toBe(true);
  });

  it("uses preset file path for custom presets", () => {
    const config = buildCliYamlFromStudio({
      presetName: "My Custom",
      isCustomPreset: true,
      sources: {},
      mapperConfig: {
        vmc: { enabled: true, host: "127.0.0.1", port: 39539 },
        live2d: { enabled: false, host: "127.0.0.1", port: 39539 },
        vrm: { enabled: false, host: "127.0.0.1", port: 39539 },
        loggerEnabled: false,
        loggerThrottleMs: 5000,
      },
    });

    expect(config.preset).toBe("./My-Custom.pfpreset");
    expect(config.presetName).toBeUndefined();
  });

  it("serializes yaml with header comments", () => {
    const yaml = serializeCliYamlConfig(
      {
        version: 1,
        presetName: "Idle",
      },
      { includeCustomPresetNote: false },
    );

    expect(yaml).toContain("# Exported from PuppetFlow Studio");
    expect(yaml).toContain("presetName: Idle");
  });

  it("merges cli overrides onto yaml launch config", () => {
    const base = yamlConfigToLaunchConfig(
      {
        presetName: "Idle",
        sources: { http: "http://localhost:3000/input" },
        adapters: { vmc: { enabled: true, host: "127.0.0.1", port: 39539 } },
      },
      "{}",
    );

    const merged = mergeLaunchConfig(base, {
      sources: { wsUrl: "ws://localhost:8080/input" },
      adapters: { logger: { enabled: false } },
    });

    expect(merged.sources?.httpUrl).toBe("http://localhost:3000/input");
    expect(merged.sources?.wsUrl).toBe("ws://localhost:8080/input");
    expect(merged.adapters?.logger?.enabled).toBe(false);
  });

  it("includes micro behaviors file path when requested", () => {
    const config = buildCliYamlFromStudio({
      presetName: "Idle",
      isCustomPreset: false,
      sources: {},
      mapperConfig: {
        vmc: { enabled: true, host: "127.0.0.1", port: 39539 },
        live2d: { enabled: false, host: "127.0.0.1", port: 39539 },
        vrm: { enabled: false, host: "127.0.0.1", port: 39539 },
        loggerEnabled: false,
        loggerThrottleMs: 5000,
      },
      includeMicroBehaviorsFile: true,
    });

    expect(config.microBehaviors).toBe("./micro-behaviors.pfmicrobehaviors");
  });

  it("rejects unsupported config versions", () => {
    expect(() =>
      parseYamlConfig({
        version: 99,
        preset: "demo.pfpreset",
      }),
    ).toThrow(/Unsupported config version/);
  });
});
