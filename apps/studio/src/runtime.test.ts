import { describe, expect, it } from "vitest";
import { cloneMapperConfig, DEFAULT_MAPPER_CONFIG } from "./mapper-config";
import { attachMapperOutputs } from "./runtime";
import { PuppetFlowRuntime } from "@puppetflow/runtime";

describe("attachMapperOutputs", () => {
  it("registers only the VMC Tauri adapter for motion-frame output", () => {
    const mapperConfig = cloneMapperConfig(DEFAULT_MAPPER_CONFIG);
    mapperConfig.vmc.enabled = true;
    mapperConfig.live2d.enabled = true;
    mapperConfig.vrm.enabled = true;
    const runtime = new PuppetFlowRuntime();

    attachMapperOutputs(runtime, mapperConfig, true);

    expect(runtime.getAdapters().map((adapter) => adapter.id)).toEqual([
      "osc-vmc",
      "osc-live2d",
      "osc-vrm",
    ]);
    expect(runtime.getMotionFrameAdapters().map((adapter) => adapter.id)).toEqual([
      "osc-vmc",
    ]);
    expect(runtime.getMotionFrameAdapters()[0]).toBe(runtime.getAdapters()[0]);
  });
});
