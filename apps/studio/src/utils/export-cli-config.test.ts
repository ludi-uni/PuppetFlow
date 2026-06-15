import { describe, expect, it, vi } from "vitest";

import { buildCliYamlFromStudio } from "@puppetflow/cli-config";

import { DEFAULT_MAPPER_CONFIG } from "../mapper-config";
import { exportStudioCliConfig } from "./export-cli-config.js";
import * as saveTextFileModule from "./save-text-file.js";

describe("exportStudioCliConfig", () => {
  it("builds export payload from studio runtime settings", () => {
    const config = buildCliYamlFromStudio({
      presetName: "Curious",
      isCustomPreset: false,
      sources: {
        httpUrl: "http://127.0.0.1:3000/input",
      },
      mapperConfig: DEFAULT_MAPPER_CONFIG,
      initialState: { interest: 0.5 },
    });

    expect(config.presetName).toBe("Curious");
    expect(config.sources?.http).toContain("3000");
  });

  it("uses presetName for builtin presets in export payload", () => {
    const config = buildCliYamlFromStudio({
      presetName: "Curious",
      isCustomPreset: false,
      sources: {
        httpUrl: null,
        wsUrl: null,
        mqttBroker: null,
        mqttTopic: null,
      },
      mapperConfig: DEFAULT_MAPPER_CONFIG,
    });

    expect(config.presetName).toBe("Curious");
    expect(config.preset).toBeUndefined();
  });

  it("returns cancelled when save dialog is dismissed", async () => {
    vi.spyOn(saveTextFileModule, "canPickSaveDirectory").mockReturnValue(false);
    vi.spyOn(saveTextFileModule, "saveTextFile").mockResolvedValue({
      ok: false,
      reason: "cancelled",
    });

    const result = await exportStudioCliConfig({
      preset: "Curious",
      isCustomPreset: false,
      sources: {
        httpUrl: null,
        wsUrl: null,
        mqttBroker: null,
        mqttTopic: null,
      },
      mapperConfig: DEFAULT_MAPPER_CONFIG,
    });

    expect(result.saved).toBe(false);
    expect(result.cancelled).toBe(true);
  });
});
