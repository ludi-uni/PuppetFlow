import type { Adapter, MotionFrameAdapter } from "@puppetflow/adapter-core";
import {
  DEFAULT_MOTION_STATE,
  MOTION_STATE_KEYS,
  type MotionFrame,
  type MotionState,
} from "@puppetflow/core";
import {
  mapCustomMotion,
  mapMotion,
  VMC_PROFILE,
  type MotionMapperProfile,
  type ValueTransform,
} from "@puppetflow/motion-mapper";
import { DEFAULT_VMC_HOST, DEFAULT_VMC_PORT } from "./types.js";
import type { VmcTimestampMode } from "./types.js";

export interface TauriOscAdapterConfig {
  id?: string;
  host?: string;
  port?: number;
  profile?: MotionMapperProfile;
  customParams?: Record<string, string>;
  customTransforms?: Record<string, ValueTransform>;
  outputRateHz?: number;
  timestampMode?: VmcTimestampMode;
  now?: () => number;
}

let tauriOscEnabled = true;

export function setTauriOscEnabled(enabled: boolean): void {
  tauriOscEnabled = enabled;
}

export function isTauriOscEnabled(): boolean {
  return tauriOscEnabled;
}

export class TauriOscAdapter implements Adapter, MotionFrameAdapter {
  readonly id: string;
  private readonly host: string;
  private readonly port: number;
  private readonly profile: MotionMapperProfile;
  private readonly customParams: Record<string, string>;
  private readonly customTransforms: Record<string, ValueTransform>;
  private readonly outputRateHz: number | undefined;
  private readonly timestampMode: VmcTimestampMode;
  private readonly now: () => number;
  private lastFrameSentAt: number | null = null;

  constructor(config: TauriOscAdapterConfig = {}) {
    this.id = config.id ?? "osc-tauri";
    this.host = config.host ?? DEFAULT_VMC_HOST;
    this.port = config.port ?? DEFAULT_VMC_PORT;
    this.profile = config.profile ?? VMC_PROFILE;
    this.customParams = config.customParams ?? {};
    this.customTransforms = config.customTransforms ?? {};
    if (
      config.outputRateHz !== undefined &&
      (!Number.isFinite(config.outputRateHz) || config.outputRateHz <= 0)
    ) {
      throw new RangeError("outputRateHz must be a positive finite number");
    }
    this.outputRateHz = config.outputRateHz;
    this.timestampMode = config.timestampMode ?? "send-time";
    this.now = config.now ?? (() => performance.now());
  }

  async initialize(): Promise<void> {}

  async update(motion: MotionState, _deltaTime: number): Promise<void> {
    if (!tauriOscEnabled) {
      return;
    }

    const { invoke, isTauri } = await import("@tauri-apps/api/core");
    if (!isTauri()) {
      return;
    }

    try {
      const params = {
        ...mapMotion(motion, this.profile),
        ...mapCustomMotion(motion, this.customParams, this.customTransforms),
      };
      await invoke("osc_send_blend_params", {
        host: this.host,
        port: this.port,
        params,
      });
    } catch (error) {
      console.error(`[${this.id}] OSC send failed`, error);
    }
  }

  async updateFrame(frame: MotionFrame, _deltaTime: number): Promise<void> {
    if (!tauriOscEnabled) {
      return;
    }

    const now = this.now();
    const intervalMs = this.outputRateHz === undefined ? 0 : 1000 / this.outputRateHz;
    if (this.lastFrameSentAt !== null && now - this.lastFrameSentAt < intervalMs) {
      return;
    }

    const { invoke, isTauri } = await import("@tauri-apps/api/core");
    if (!isTauri()) {
      return;
    }

    const bones = Object.entries(frame.bones ?? []).flatMap(([name, transform]) => {
      if (!transform.position || !transform.rotation) {
        return [];
      }
      return [{ name, position: transform.position, rotation: transform.rotation }];
    });
    const mappedParameters = mapFrameParameters(
      frame.parameters,
      this.profile,
      this.customParams,
      this.customTransforms,
    );
    const blendShapes = {
      ...frame.blendShapes,
      ...Object.fromEntries(mappedParameters),
    };
    const frameUnix =
      this.timestampMode === "frame-unix" && frame.metadata?.clock === "unix";

    try {
      await invoke("osc_send_motion_frame", {
        host: this.host,
        port: this.port,
        bones,
        blendShapes,
        timestampMode: frameUnix
          ? "frame-unix"
          : this.timestampMode === "frame-unix"
            ? "send-time"
            : this.timestampMode,
        timestampMs: frameUnix ? frame.timestamp : null,
      });
      this.lastFrameSentAt = now;
    } catch (error) {
      console.error(`[${this.id}] OSC motion frame send failed`, error);
    }
  }

  async dispose(): Promise<void> {}
}

function mapFrameParameters(
  parameters: Record<string, number> | undefined,
  profile: MotionMapperProfile,
  customParams: Record<string, string>,
  customTransforms: Record<string, ValueTransform>,
): Array<[string, number]> {
  if (!parameters) {
    return [];
  }

  const motion: MotionState = { ...DEFAULT_MOTION_STATE, custom: {} };
  for (const key of MOTION_STATE_KEYS) {
    const value = parameters[key];
    if (value !== undefined) {
      motion[key] = value;
    }
  }
  motion.custom = Object.fromEntries(
    Object.entries(parameters).filter(
      ([key]) => !MOTION_STATE_KEYS.includes(key as (typeof MOTION_STATE_KEYS)[number]),
    ),
  );

  const mapped = mapMotion(motion, profile);
  const suppliedMappedParams = new Set(
    Object.entries(profile.rules)
      .filter(([key, rule]) => rule && parameters[key] !== undefined)
      .map(([, rule]) => rule?.param)
      .filter((param): param is string => param !== undefined),
  );
  return [
    ...Object.entries(mapped).filter(([param]) => suppliedMappedParams.has(param)),
    ...Object.entries(mapCustomMotion(motion, customParams, customTransforms)),
  ];
}
