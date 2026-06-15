import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_MAPPER_CONFIG } from "../mapper-config";
import {
  loadPersistedMapperConfig,
  loadPersistedSourceConfig,
  loadPersistedSourceDraft,
  loadPersistedStudioMode,
  loadPersistedTab,
  patchStudioPersistedConfig,
  reloadStudioPersistedConfigFromStorage,
  resetStudioPersistedConfigForTests,
  savePersistedMapperConfig,
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

  it("reloads from localStorage after patch", () => {
    patchStudioPersistedConfig({ studioMode: "simple" });
    reloadStudioPersistedConfigFromStorage();
    expect(loadPersistedStudioMode()).toBe("simple");
  });
});
