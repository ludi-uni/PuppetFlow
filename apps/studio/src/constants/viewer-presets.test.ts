import { describe, expect, it } from "vitest";
import { DEFAULT_MAPPER_CONFIG } from "../mapper-config.js";
import {
  applyViewerPreset,
  detectViewerPreset,
  VIEWER_PRESETS,
} from "./viewer-presets.js";

describe("viewer-presets", () => {
  it("configures nijiexpose for Inochi2D / nijigenerate puppet parameters", () => {
    const nijiexpose = VIEWER_PRESETS.find((preset) => preset.id === "nijiexpose");
    expect(nijiexpose?.primaryTarget).toBe("live2d");
    expect(nijiexpose?.description).toContain("Inochi2D");

    const applied = applyViewerPreset(DEFAULT_MAPPER_CONFIG, nijiexpose!);

    expect(applied.viewerPresetId).toBe("nijiexpose");
    expect(applied.live2d.enabled).toBe(true);
    expect(applied.vmc.enabled).toBe(false);
    expect(applied.vrm.enabled).toBe(false);
    expect(applied.live2d.params.mouthX).toBe("ParamMouthForm");
    expect(applied.live2d.port).toBe(39539);
  });

  it("resets parameter mappings when switching viewer presets", () => {
    const vrmPreset = VIEWER_PRESETS.find((preset) => preset.id === "vrm")!;
    const nijiexpose = VIEWER_PRESETS.find((preset) => preset.id === "nijiexpose")!;

    const vrmApplied = applyViewerPreset(DEFAULT_MAPPER_CONFIG, vrmPreset);
    expect(vrmApplied.vrm.params.mouthX).toBe("Fcl_MTH_Smile");

    const nijiApplied = applyViewerPreset(vrmApplied, nijiexpose);
    expect(nijiApplied.live2d.params.mouthX).toBe("ParamMouthForm");
    expect(nijiApplied.vrm.params.mouthX).toBe("Fcl_MTH_Smile");
  });

  it("restores viewer preset id from stored mapper config", () => {
    const nijiexpose = VIEWER_PRESETS.find((preset) => preset.id === "nijiexpose")!;
    const applied = applyViewerPreset(DEFAULT_MAPPER_CONFIG, nijiexpose);

    expect(detectViewerPreset(applied)).toBe("nijiexpose");
  });
});
