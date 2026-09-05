import {
  NodeVmcAdapter,
  type NodeVmcAdapterConfig,
} from "@puppetflow/adapter-vmc/node";
import type { MotionFrame, MotionState } from "@puppetflow/core";
import {
  mapCustomMotion,
  mapMotion,
  profileFromParamNames,
  VMC_PROFILE,
  type MotionMapperProfile,
} from "@puppetflow/motion-mapper";
import {
  ActingEngine,
  createPuppetFlowControl,
  type ActingEngineOptions,
  type MotionFrameAdapter,
  type PuppetFlowControl,
  type StateSource,
} from "@puppetflow/runtime";
import { WebSocketSource } from "@puppetflow/source-websocket";

import { createAvatarLipSyncSource } from "./avatar-lip-sync-source.js";
import { buildRuntime } from "./build-runtime.js";

export interface PuppetFlowHostOptions {
  presetJson: string;
  acting: ActingEngineOptions;
  vmc?: NodeVmcAdapterConfig | false;
  avatarInputWsUrl?: string;
  sources?: readonly StateSource[];
  motionAdapters?: readonly MotionFrameAdapter[];
}

export interface PuppetFlowHost {
  readonly control: PuppetFlowControl;
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}

export function createPuppetFlowHost(options: PuppetFlowHostOptions): PuppetFlowHost {
  let startupFailure: { error: unknown } | undefined;
  let startPromise: Promise<void> | undefined;
  const runtime = buildRuntime({
    presetJson: options.presetJson,
    adapters: {
      vmc: { enabled: false },
      live2d: { enabled: false },
      vrm: { enabled: false },
      websocket: { enabled: false },
      logger: { enabled: false },
    },
  });
  runtime.attachActingEngine(new ActingEngine(options.acting));
  for (const source of options.sources ?? []) runtime.attachSource(source);
  if (options.avatarInputWsUrl?.trim()) {
    runtime.attachSource(
      createAvatarLipSyncSource(
        new WebSocketSource({ url: options.avatarInputWsUrl.trim() }),
      ),
    );
  }
  for (const adapter of new Set(options.motionAdapters ?? [])) {
    runtime.attachMotionAdapter(
      wrapRequiredMotionOutput(
        adapter,
        (error) => {
          startupFailure ??= { error };
        },
        () => startupFailure !== undefined,
      ),
    );
  }
  if (options.vmc !== false && options.vmc !== undefined) {
    const output = createVmcOutput(
      options.vmc,
      (error) => {
        startupFailure ??= { error };
      },
      () => startupFailure !== undefined,
    );
    runtime.attachAdapter(output).attachMotionAdapter(output);
  }

  let disposed = false;
  let disposePromise: Promise<void> | undefined;
  const control = createPuppetFlowControl(runtime);
  return {
    control,
    start(): Promise<void> {
      if (disposed) return Promise.reject(new Error("PuppetFlowHost is disposed"));
      if (startPromise) return startPromise;
      startupFailure = undefined;
      const start = runtime.start().then(async () => {
        const failure = startupFailure;
        if (failure === undefined) return;
        await runtime.stop();
        throw failure.error;
      });
      startPromise = start;
      void start.then(
        () => {
          if (startPromise === start) startPromise = undefined;
        },
        () => {
          if (startPromise === start) startPromise = undefined;
        },
      );
      return start;
    },
    stop: () => runtime.stop(),
    dispose(): Promise<void> {
      if (!disposePromise) {
        disposed = true;
        disposePromise = runtime.stop();
      }
      return disposePromise;
    },
  };
}

function createVmcOutput(
  config: NodeVmcAdapterConfig,
  recordStartupFailure: (error: unknown) => void,
  hasStartupFailure: () => boolean,
): MotionFrameAdapter & {
  update(motion: MotionState, deltaTime: number): Promise<void>;
} {
  const adapter = new NodeVmcAdapter(config);
  const profile = resolveVmcProfile(config);
  let mappedBlendShapes: Record<string, number> = {};
  return {
    id: adapter.id,
    async initialize(): Promise<void> {
      try {
        await adapter.initialize();
      } catch (error) {
        recordStartupFailure(error);
        throw error;
      }
    },
    async update(motion: MotionState, _deltaTime: number): Promise<void> {
      if (hasStartupFailure()) return;
      mappedBlendShapes = {
        ...mapMotion(motion, profile),
        ...mapCustomMotion(motion, config.customParams ?? {}, config.customTransforms),
      };
    },
    updateFrame(frame: MotionFrame, deltaTime: number): Promise<void> {
      if (hasStartupFailure()) return Promise.resolve();
      return adapter.updateFrame(
        { ...frame, blendShapes: { ...mappedBlendShapes, ...frame.blendShapes } },
        deltaTime,
      );
    },
    dispose: () => adapter.dispose(),
  };
}

function wrapRequiredMotionOutput(
  adapter: MotionFrameAdapter,
  recordStartupFailure: (error: unknown) => void,
  hasStartupFailure: () => boolean,
): MotionFrameAdapter {
  let failed = false;
  return {
    id: adapter.id,
    async initialize(): Promise<void> {
      failed = false;
      try {
        await adapter.initialize();
      } catch (error) {
        failed = true;
        recordStartupFailure(error);
        throw error;
      }
    },
    updateFrame(frame: MotionFrame, deltaTime: number): Promise<void> {
      return failed || hasStartupFailure()
        ? Promise.resolve()
        : adapter.updateFrame(frame, deltaTime);
    },
    dispose: () => adapter.dispose(),
  };
}

function resolveVmcProfile(config: NodeVmcAdapterConfig): MotionMapperProfile {
  if (config.profile) return config.profile;
  if (config.mapping) {
    return profileFromParamNames("vmc", config.mapping, "vmc-custom", "VMC Custom");
  }
  return VMC_PROFILE;
}
