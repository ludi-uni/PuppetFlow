/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MAPPER_CONFIG } from "../mapper-config";
import {
  loadPersistedMapperConfig,
  loadPersistedBlocklyEnabled,
  loadPersistedSourceConfig,
  loadPersistedSourceDraft,
  loadPersistedStudioMode,
  loadPersistedTab,
  patchStudioPersistedConfig,
  reloadStudioPersistedConfigFromStorage,
  resetStudioPersistedConfigForTests,
  savePersistedMapperConfig,
  savePersistedBlocklyEnabled,
  savePersistedSourceConfig,
  savePersistedSourceDraft,
  savePersistedStudioMode,
  savePersistedTab,
} from "./studio-config-storage.js";

describe("studio-config-storage", () => {
  afterEach(() => {
    resetStudioPersistedConfigForTests();
  });

  it("persists studio mode and tab per mode", () => {
    savePersistedStudioMode("expert");
    savePersistedTab("expert", "pfscript");
    savePersistedTab("simple", "mapper");

    expect(loadPersistedStudioMode()).toBe("expert");
    expect(loadPersistedTab("expert")).toBe("pfscript");
    expect(loadPersistedTab("simple")).toBe("mapper");
  });

  it("keeps Blockly disabled by default and persists explicit opt-in", () => {
    expect(loadPersistedBlocklyEnabled()).toBe(false);

    savePersistedTab("expert", "pfscript");
    savePersistedBlocklyEnabled(true);

    expect(loadPersistedBlocklyEnabled()).toBe(true);
    const reloaded = reloadStudioPersistedConfigFromStorage();
    expect(reloaded.blocklyEnabled).toBe(true);
    expect(reloaded.tabs?.expert).toBe("pfscript");
  });

  it("persists mapper and source settings", () => {
    const mapper = {
      ...DEFAULT_MAPPER_CONFIG,
      viewerPresetId: "nijiexpose",
      live2d: {
        ...DEFAULT_MAPPER_CONFIG.live2d,
        enabled: true,
        port: 39540,
      },
    };

    savePersistedMapperConfig(mapper);
    savePersistedSourceConfig({
      httpUrl: "http://127.0.0.1:8080/state",
      wsUrl: null,
      mqttBroker: null,
      mqttTopic: null,
    });
    savePersistedSourceDraft({
      httpUrl: "http://127.0.0.1:8080/state",
      wsUrl: "ws://localhost:9000",
      mqttBroker: "",
      mqttTopic: "",
    });

    expect(loadPersistedMapperConfig()?.viewerPresetId).toBe("nijiexpose");
    expect(loadPersistedMapperConfig()?.live2d.port).toBe(39540);
    expect(loadPersistedSourceConfig()?.httpUrl).toContain("8080");
    expect(loadPersistedSourceDraft()?.wsUrl).toContain("9000");
  });

  it("persists and restores VMC input settings", () => {
    savePersistedSourceConfig({
      httpUrl: null,
      wsUrl: null,
      mqttBroker: null,
      mqttTopic: null,
      vmc: {
        enabled: true,
        host: "0.0.0.0",
        port: 39541,
        profile: "slimevr-compatible",
        positionScale: 0.01,
        rootPolicy: "hips-only",
      },
    });

    const restored = loadPersistedSourceConfig();
    expect(restored?.vmc?.enabled).toBe(true);
    expect(restored?.vmc?.port).toBe(39541);
    expect(restored?.vmc?.profile).toBe("slimevr-compatible");
    expect(restored?.vmc?.rootPolicy).toBe("hips-only");
  });

  it.each([
    { label: "applied on", enabled: true, draftOnly: false },
    { label: "applied off", enabled: false, draftOnly: false },
    { label: "draft on", enabled: true, draftOnly: true },
    { label: "draft off", enabled: false, draftOnly: true },
  ])(
    "restores saved VMC settings on cold import ($label)",
    async ({ enabled, draftOnly }) => {
      const vmc = {
        enabled,
        host: "127.0.0.1",
        port: 39540,
        profile: "generic-vmc",
        positionScale: 0.5,
        rootPolicy: "hips-only",
      };
      const sources = draftOnly
        ? { httpUrl: "", wsUrl: "", mqttBroker: "", mqttTopic: "", vmc }
        : { httpUrl: null, wsUrl: null, mqttBroker: null, mqttTopic: null, vmc };
      const mapper = { ...DEFAULT_MAPPER_CONFIG, viewerPresetId: "nijiexpose" };
      localStorage.setItem(
        "puppetflow.studio.config.v1",
        JSON.stringify({
          version: 1,
          studioMode: "expert",
          tabs: { expert: "sources" },
          mapper,
          [draftOnly ? "sourceDraft" : "sources"]: sources,
        }),
      );

      vi.resetModules();
      const cold = await import("./studio-config-storage.js");

      expect(cold.loadPersistedStudioMode()).toBe("expert");
      expect(cold.loadPersistedTab("expert")).toBe("sources");
      expect(cold.loadPersistedMapperConfig()).toEqual(mapper);
      expect(
        draftOnly ? cold.loadPersistedSourceDraft() : cold.loadPersistedSourceConfig(),
      ).toEqual(sources);
    },
  );

  it("loads existing config without a vmc key", () => {
    savePersistedSourceConfig({
      httpUrl: "http://localhost:1",
      wsUrl: null,
      mqttBroker: null,
      mqttTopic: null,
    });

    const restored = loadPersistedSourceConfig();
    expect(restored?.vmc).toBeUndefined();
    expect(restored?.httpUrl).toContain("localhost");
  });

  it("reloads from localStorage after patch", () => {
    patchStudioPersistedConfig({ studioMode: "simple" });
    reloadStudioPersistedConfigFromStorage();
    expect(loadPersistedStudioMode()).toBe("simple");
  });
});
