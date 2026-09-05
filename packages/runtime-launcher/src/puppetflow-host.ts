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
import { createPuppetFlowControl, type PuppetFlowControl } from "@puppetflow/control";
import {
  ActingEngine,
  type ActingEngineOptions,
  type MotionFrameAdapter,
  type StateSource,
} from "@puppetflow/runtime";
import { WebSocketSource } from "@puppetflow/source-websocket";

import { createAvatarLipSyncSource } from "./avatar-lip-sync-source.js";
import {
  createAuthenticatedAvatarSocketFactory,
  type AvatarInputCredential,
} from "./avatar-input-websocket.js";
import { buildRuntime } from "./build-runtime.js";
import {
  buildMotionMapperProfileFromLaunch,
  customMappingsFromLaunch,
} from "./mapper-launch.js";
import type { OscAdapterLaunchConfig, RuntimeLaunchConfig } from "./types.js";

export interface PuppetFlowHostOptions {
  presetJson?: string;
  /** Existing CLI launch configuration; the shared service still owns one Host. */
  launchConfig?: RuntimeLaunchConfig;
  acting: ActingEngineOptions;
  vmc?: NodeVmcAdapterConfig | false;
  avatarInputWsUrl?: string;
  avatarInputCredential?: AvatarInputCredential;
  onAvatarInputUnavailable?: (reason: string) => void;
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
  if (!options.launchConfig && !options.presetJson) {
    throw new Error("PuppetFlowHost requires presetJson or launchConfig");
  }
  const launchVmc = options.launchConfig
    ? nodeVmcConfigFromLaunch(options.launchConfig.adapters?.vmc)
    : false;
  if (options.launchConfig && options.vmc !== undefined && launchVmc !== false) {
    throw new Error("Specify VMC output through launchConfig or options.vmc, not both");
  }
  const launchConfig = options.launchConfig
    ? {
        ...options.launchConfig,
        adapters: {
          ...options.launchConfig.adapters,
          vmc: { enabled: false },
        },
      }
    : undefined;
  const runtime = buildRuntime(
    launchConfig ?? {
      presetJson: options.presetJson!,
      adapters: {
        vmc: { enabled: false },
        live2d: { enabled: false },
        vrm: { enabled: false },
        websocket: { enabled: false },
        logger: { enabled: false },
      },
    },
  );
  runtime.attachActingEngine(new ActingEngine(options.acting));
  for (const source of options.sources ?? []) runtime.attachSource(source);
  if (options.avatarInputWsUrl?.trim()) {
    runtime.attachSource(
      createAvatarLipSyncSource(
        new WebSocketSource({
          url: options.avatarInputWsUrl.trim(),
          readyOnFirstPayload: true,
          onConnectionError: (error) =>
            options.onAvatarInputUnavailable?.(error.message),
          ...(options.avatarInputCredential === undefined
            ? {}
            : {
                socketFactory: createAuthenticatedAvatarSocketFactory(
                  options.avatarInputCredential,
                ),
              }),
        }),
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
  const vmc = options.vmc === undefined ? launchVmc : options.vmc;
  if (vmc !== false && vmc !== undefined) {
    const output = createVmcOutput(
      vmc,
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

function nodeVmcConfigFromLaunch(
  config: OscAdapterLaunchConfig | undefined,
): NodeVmcAdapterConfig | false {
  if (config?.enabled === false) return false;
  const selected = config ?? {};
  const { customParams, customTransforms } = customMappingsFromLaunch(selected);
  return {
    host: selected.host,
    port: selected.port,
    profile: buildMotionMapperProfileFromLaunch("vmc", selected),
    customParams,
    customTransforms,
    outputRateHz: selected.outputRateHz,
    timestampMode: selected.timestampMode,
  };
}

function createVmcOutput(
  config: NodeVmcAdapterConfig,
  recordStartupFailure: (error: unknown) => void,
  hasStartupFailure: () => boolean,
): MotionFrameAdapter & {
  update(motion: MotionState, deltaTime: number): Promise<void>;
} {
  if (
    config.outputRateHz !== undefined &&
    (!Number.isFinite(config.outputRateHz) || config.outputRateHz <= 0)
  ) {
    throw new RangeError("outputRateHz must be a positive finite number");
  }
  const adapter = new NodeVmcAdapter({ ...config, outputRateHz: undefined });
  const profile = resolveVmcProfile(config);
  const now = config.now ?? Date.now;
  const intervalMs = config.outputRateHz === undefined ? 0 : 1000 / config.outputRateHz;
  let mappedBlendShapes: Record<string, number> = {};
  let lastSentAt: number | null = null;
  let lastObservedBlends: Record<string, number> = {};
  let pendingBlends: Record<string, number> | undefined;
  let pendingTerminalZero: Record<string, number> | undefined;
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
      const frameBlends = { ...frame.blendShapes };
      if (!sameBlendShapes(frameBlends, lastObservedBlends)) {
        if (
          Object.entries(frameBlends).some(
            ([name, value]) => value === 0 && (lastObservedBlends[name] ?? 0) !== 0,
          )
        ) {
          pendingTerminalZero = frameBlends;
        }
        pendingBlends = frameBlends;
        lastObservedBlends = frameBlends;
      }
      const currentTime = now();
      if (lastSentAt !== null && currentTime - lastSentAt < intervalMs) {
        return Promise.resolve();
      }
      const selectedBlends = pendingTerminalZero ?? pendingBlends ?? frameBlends;
      if (pendingTerminalZero) {
        pendingTerminalZero = undefined;
        if (sameBlendShapes(selectedBlends, pendingBlends ?? {})) {
          pendingBlends = undefined;
        }
      } else {
        pendingBlends = undefined;
      }
      lastSentAt = currentTime;
      return adapter.updateFrame(
        { ...frame, blendShapes: { ...mappedBlendShapes, ...selectedBlends } },
        deltaTime,
      );
    },
    dispose: () => adapter.dispose(),
  };
}

function sameBlendShapes(
  left: Record<string, number>,
  right: Record<string, number>,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => left[key] === right[key]);
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
