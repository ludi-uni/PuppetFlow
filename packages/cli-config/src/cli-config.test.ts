import { describe, expect, it } from "vitest";
import {
  getDefaultProfile,
  profileToParamNames,
  profileToTransforms,
} from "@puppetflow/motion-mapper";

import {
  buildCliYamlFromStudio,
  mergeLaunchConfig,
  parseYamlConfig,
  serializeCliYamlConfig,
  yamlConfigToLaunchConfig,
  type StudioOscMapperModel,
} from "./index.js";

function createMapperModel(target: "vmc" | "live2d" | "vrm"): StudioOscMapperModel {
  const profile = getDefaultProfile(target);
  return {
    enabled: target === "vmc",
    host: "127.0.0.1",
    port: 39539,
    params: profileToParamNames(profile),
    transforms: profileToTransforms(profile),
    customParams: {},
    customTransforms: {},
  };
}

function createMapperConfig() {
  return {
    vmc: createMapperModel("vmc"),
    live2d: createMapperModel("live2d"),
    vrm: createMapperModel("vrm"),
    loggerEnabled: true,
    loggerThrottleMs: 5000,
  };
}

describe("cli-config", () => {
  it("builds yaml config from studio applied settings", () => {
    const config = buildCliYamlFromStudio({
      presetName: "Curious",
      isCustomPreset: false,
      sources: {
        httpUrl: "http://127.0.0.1:3000/input",
        wsUrl: "ws://127.0.0.1:8080/input",
      },
      mapperConfig: createMapperConfig(),
      initialState: { interest: 0.6, energy: 0.5 },
    });

    expect(config.version).toBe(2);
    expect(config.presetName).toBe("Curious");
    expect(config.sources?.http).toBe("http://127.0.0.1:3000/input");
    expect(config.adapters?.vmc?.enabled).toBe(true);
    expect(config.adapters?.vmc?.params).toBeDefined();
  });

  it("uses preset file path for custom presets", () => {
    const config = buildCliYamlFromStudio({
      presetName: "My Custom",
      isCustomPreset: true,
      sources: {},
      mapperConfig: createMapperConfig(),
    });

    expect(config.preset).toBe("./My-Custom.pfpreset");
    expect(config.presetName).toBeUndefined();
  });

  it("serializes yaml with header comments", () => {
    const yaml = serializeCliYamlConfig(
      {
        version: 2,
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
        ...createMapperConfig(),
        loggerEnabled: false,
      },
      includeMicroBehaviorsFile: true,
    });

    expect(config.microBehaviors).toBe("./micro-behaviors.pfmicrobehaviors");
  });

  it("accepts version 1 configs without mapper fields", () => {
    const config = parseYamlConfig({
      version: 1,
      presetName: "Curious",
      adapters: {
        vmc: { enabled: true, host: "127.0.0.1", port: 39539 },
      },
    });

    expect(config.version).toBe(1);
    expect(config.adapters?.vmc?.params).toBeUndefined();
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
