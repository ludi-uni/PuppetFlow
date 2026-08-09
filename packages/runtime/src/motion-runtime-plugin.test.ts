import {
  registerMotionRuntimePlugins,
  type MotionRuntimePlugin,
} from "@puppetflow/extension-core";
import { createMotionFramePipeline } from "@puppetflow/motion-pipeline";
import { expect, it, vi } from "vitest";
import { PuppetFlowRuntime } from "./runtime.js";

it("runs plugin-created source, filter, and adapter through Runtime", async () => {
  const updateFrame = vi.fn(async () => {});
  const reset = vi.fn();
  const plugin: MotionRuntimePlugin = {
    id: "synthetic",
    register(registry) {
      registry.addSourceFactory({
        type: "synthetic",
        create: () => ({
          id: "synthetic",
          start: async (emit) => emit({ timestamp: 1, parameters: { value: 2 } }),
          stop: async () => {},
        }),
      });
      registry.addFilterFactory({
        type: "double",
        create: () => ({
          id: "double",
          apply: (frame) => ({
            ...frame,
            parameters: {
              ...frame.parameters,
              value: (frame.parameters?.value ?? 0) * 2,
            },
          }),
          reset,
        }),
      });
      registry.addFrameAdapterFactory({
        type: "capture",
        create: () => ({
          id: "capture",
          initialize: async () => {},
          updateFrame,
          dispose: async () => {},
        }),
      });
    },
  };

  const registry = registerMotionRuntimePlugins([plugin]);
  const source = registry.createSource("synthetic", {});
  const filter = registry.createFilter("double", {});
  const adapter = registry.createFrameAdapter("capture", {});
  const runtime = new PuppetFlowRuntime()
    .attachMotionSource(source)
    .attachMotionPipeline(
      createMotionFramePipeline({ sourceFilters: { synthetic: [filter] } }),
    )
    .attachMotionAdapter(adapter);

  await runtime.start();
  expect(updateFrame).toHaveBeenCalledWith(
    expect.objectContaining({ parameters: { value: 4 } }),
    expect.any(Number),
  );
  await runtime.stop();
  expect(reset).toHaveBeenCalledTimes(1);
});
