import {
  registerMotionRuntimePlugins,
  type MotionRuntimePlugin,
} from "@puppetflow/extension-core";
import { createMotionFramePipeline } from "@puppetflow/motion-pipeline";
import { PuppetFlowRuntime } from "@puppetflow/runtime";

const runtimePlugin: MotionRuntimePlugin = {
  id: "motion-runtime-example",
  register(registry) {
    registry.addSourceFactory({
      type: "synthetic",
      create: (config) => ({
        id: "synthetic",
        start: async (emit) => {
          const timestamp = typeof config.timestamp === "number" ? config.timestamp : 1;
          emit({
            timestamp,
            parameters: {
              value: 2,
            },
          });
        },
        stop: async () => {},
      }),
    });

    registry.addFilterFactory({
      type: "double",
      create: (config) => {
        const factor =
          typeof config.factor === "number" && Number.isFinite(config.factor)
            ? config.factor
            : 2;

        return {
          id: "double",
          apply: (frame) => ({
            ...frame,
            parameters: {
              ...frame.parameters,
              value: (frame.parameters?.value ?? 0) * factor,
            },
          }),
          reset: () => {},
        };
      },
    });

    registry.addFrameAdapterFactory({
      type: "capture",
      create: () => ({
        id: "capture",
        initialize: async () => {},
        updateFrame: async (frame) => {
          console.log(JSON.stringify(frame, null, 2));
        },
        dispose: async () => {},
      }),
    });
  },
};

const registry = registerMotionRuntimePlugins([runtimePlugin]);
const source = registry.createSource("synthetic", { timestamp: 1_000 });
const filter = registry.createFilter("double", { factor: 2 });
const adapter = registry.createFrameAdapter("capture", {});

const runtime = new PuppetFlowRuntime()
  .attachMotionSource(source)
  .attachMotionPipeline(
    createMotionFramePipeline({
      sourceFilters: {
        synthetic: [filter],
      },
    }),
  )
  .attachMotionAdapter(adapter);

let resolveFirstFrame: (() => void) | undefined;
const firstFrame = new Promise<void>((resolve) => {
  resolveFirstFrame = resolve;
});
let firstFrameCaptured = false;
const originalUpdateFrame = adapter.updateFrame;
adapter.updateFrame = async (frame, deltaTime) => {
  await originalUpdateFrame(frame, deltaTime);
  if (!firstFrameCaptured && resolveFirstFrame) {
    firstFrameCaptured = true;
    resolveFirstFrame();
  }
};

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const timeout = waitMs(2_000).then(() => {
  throw new Error("timed out waiting for the first frame");
});

try {
  await runtime.start();
  await Promise.race([firstFrame, timeout]);
  await runtime.stop();
} finally {
  if (runtime.isRunning()) {
    await runtime.stop();
  }
}
