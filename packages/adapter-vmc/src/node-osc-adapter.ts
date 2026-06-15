import { createSocket, type Socket } from "node:dgram";
import type { Adapter } from "@puppetflow/adapter-core";
import type { MotionState } from "@puppetflow/core";
import {
  mapCustomMotion,
  mapMotion,
  type MotionMapperProfile,
  type ValueTransform,
} from "@puppetflow/motion-mapper";
import { encodeBlendShapeMessage } from "./osc-encoder.js";
import { DEFAULT_VMC_HOST, DEFAULT_VMC_PORT } from "./types.js";

export interface NodeOscAdapterConfig {
  id: string;
  host?: string;
  port?: number;
  profile: MotionMapperProfile;
  customParams?: Record<string, string>;
  customTransforms?: Record<string, ValueTransform>;
}

export class NodeOscAdapter implements Adapter {
  readonly id: string;

  private readonly host: string;
  private readonly port: number;
  private readonly profile: MotionMapperProfile;
  private readonly customParams: Record<string, string>;
  private readonly customTransforms: Record<string, ValueTransform>;
  private socket: Socket | null = null;

  constructor(config: NodeOscAdapterConfig) {
    this.id = config.id;
    this.host = config.host ?? DEFAULT_VMC_HOST;
    this.port = config.port ?? DEFAULT_VMC_PORT;
    this.profile = config.profile;
    this.customParams = config.customParams ?? {};
    this.customTransforms = config.customTransforms ?? {};
  }

  async initialize(): Promise<void> {
    this.getSocket();
  }

  async update(motion: MotionState, _deltaTime: number): Promise<void> {
    const socket = this.getSocket();
    const mapped = {
      ...mapMotion(motion, this.profile),
      ...mapCustomMotion(motion, this.customParams, this.customTransforms),
    };

    for (const [param, value] of Object.entries(mapped)) {
      const packet = encodeBlendShapeMessage(param, value);
      socket.send(packet, this.port, this.host);
    }
  }

  async dispose(): Promise<void> {
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
