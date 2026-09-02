import { createSocket, type Socket } from "node:dgram";
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
  type MotionMapperProfile,
  type ValueTransform,
} from "@puppetflow/motion-mapper";
import {
  encodeBlendShapeApplyMessage,
  encodeBlendShapeMessage,
  encodeBonePoseMessage,
} from "./osc-encoder.js";
import { encodeOscBundle } from "./osc-bundle.js";
import { DEFAULT_VMC_HOST, DEFAULT_VMC_PORT, type VmcTimestampMode } from "./types.js";

export interface OscTransport {
  initialize?(): void | Promise<void>;
  send(packet: Uint8Array, port?: number, host?: string): void | Promise<void>;
  close?(): void | Promise<void>;
}

class DgramOscTransport implements OscTransport {
  private socket: Socket | null = null;

  initialize(): void {
    this.getSocket();
  }

  send(packet: Uint8Array, port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.getSocket().send(packet, port, host, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }

  private getSocket(): Socket {
    if (!this.socket) {
      this.socket = createSocket("udp4");
    }
    return this.socket;
  }
}

export interface NodeOscAdapterConfig {
  id: string;
  host?: string;
  port?: number;
  profile: MotionMapperProfile;
  customParams?: Record<string, string>;
  customTransforms?: Record<string, ValueTransform>;
  transport?: OscTransport;
  outputRateHz?: number;
  timestampMode?: VmcTimestampMode;
  now?: () => number;
}

export class NodeOscAdapter implements Adapter, MotionFrameAdapter {
  readonly id: string;

  private readonly host: string;
  private readonly port: number;
  private readonly profile: MotionMapperProfile;
  private readonly customParams: Record<string, string>;
  private readonly customTransforms: Record<string, ValueTransform>;
  private readonly transport: OscTransport;
  private readonly outputRateHz: number | undefined;
  private readonly timestampMode: VmcTimestampMode;
  private readonly now: () => number;
  private lastFrameSentAt: number | null = null;

  constructor(config: NodeOscAdapterConfig) {
    this.id = config.id;
    this.host = config.host ?? DEFAULT_VMC_HOST;
    this.port = config.port ?? DEFAULT_VMC_PORT;
    this.profile = config.profile;
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
    this.now = config.now ?? Date.now;
    this.transport = config.transport ?? new DgramOscTransport();
  }

  async initialize(): Promise<void> {
    await this.transport.initialize?.();
  }

  async update(motion: MotionState, _deltaTime: number): Promise<void> {
    const mapped = {
      ...mapMotion(motion, this.profile),
      ...mapCustomMotion(motion, this.customParams, this.customTransforms),
    };

    const blendShapeEntries = Object.entries(mapped);
    for (const [param, value] of blendShapeEntries) {
      const packet = encodeBlendShapeMessage(param, value);
      await this.transport.send(packet, this.port, this.host);
    }
    if (blendShapeEntries.length > 0) {
      await this.transport.send(encodeBlendShapeApplyMessage(), this.port, this.host);
    }
  }

  async updateFrame(frame: MotionFrame, _deltaTime: number): Promise<void> {
    const now = this.now();
    const intervalMs = this.outputRateHz === undefined ? 0 : 1000 / this.outputRateHz;
    if (this.lastFrameSentAt !== null && now - this.lastFrameSentAt < intervalMs) {
      return;
    }

    const messages: Uint8Array[] = [];
    for (const [boneName, transform] of Object.entries(frame.bones ?? {})) {
      const message = encodeBonePoseMessage(boneName, transform);
      if (message) {
        messages.push(message);
      }
    }

    let hasBlendShapeValues = false;
    for (const [blendName, value] of Object.entries(frame.blendShapes ?? {})) {
      messages.push(encodeBlendShapeMessage(blendName, value));
      hasBlendShapeValues = true;
    }

    for (const [param, value] of mapFrameParameters(
      frame.parameters,
      this.profile,
      this.customParams,
      this.customTransforms,
    )) {
      messages.push(encodeBlendShapeMessage(param, value));
      hasBlendShapeValues = true;
    }

    if (hasBlendShapeValues) {
      messages.push(encodeBlendShapeApplyMessage());
    }

    if (messages.length === 0) {
      return;
    }

    const useFrameUnix =
      this.timestampMode === "frame-unix" && frame.metadata?.clock === "unix";
    const packet = encodeOscBundle(messages, {
      mode:
        useFrameUnix || this.timestampMode !== "frame-unix"
          ? this.timestampMode
          : "send-time",
      timestampMs: useFrameUnix ? frame.timestamp : undefined,
      nowMs: now,
    });
    await this.transport.send(packet, this.port, this.host);
    this.lastFrameSentAt = now;
  }

  async dispose(): Promise<void> {
    await this.transport.close?.();
  }
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

  const suppliedKeys = new Set(Object.keys(parameters));
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
      .filter(([key, rule]) => rule && suppliedKeys.has(key))
      .map(([, rule]) => rule?.param)
      .filter((param): param is string => param !== undefined),
  );
  const filteredStandard = Object.entries(mapped).filter(([param]) =>
    suppliedMappedParams.has(param),
  );
  const mappedCustom = mapCustomMotion(motion, customParams, customTransforms);
  return [...filteredStandard, ...Object.entries(mappedCustom)];
}
