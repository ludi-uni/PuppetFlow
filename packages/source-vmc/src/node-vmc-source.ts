import { createSocket, type RemoteInfo, type Socket } from "node:dgram";
import type { AddressInfo } from "node:net";

import type { MotionFrameEmitter, MotionSource } from "@puppetflow/source-core";

import { applyVmcEvents, createVmcFrameState } from "./normalize.js";
import { decodeVmcPacket } from "./osc-decoder.js";
import {
  resolveVmcInputProfile,
  type VmcInputProfileId,
  type VmcInputProfileOverrides,
} from "./profiles.js";

export interface NodeVmcSourceOptions extends VmcInputProfileOverrides {
  id?: string;
  host?: string;
  port?: number;
  profile?: VmcInputProfileId;
}

export class NodeVmcSource implements MotionSource {
  readonly id: string;

  private readonly host: string;
  private readonly port: number;
  private readonly profile;
  private socket: Socket | null = null;
  private sequence = 0;
  private state = createVmcFrameState();

  constructor(options: NodeVmcSourceOptions = {}) {
    this.id = options.id ?? "vmc-input";
    this.host = options.host?.trim() || "127.0.0.1";
    this.port = options.port ?? 39540;
    if (!Number.isInteger(this.port) || this.port < 0 || this.port > 65535) {
      throw new Error("VMC input port must be an integer from 0 to 65535");
    }
    this.profile = resolveVmcInputProfile(options.profile, {
      positionScale: options.positionScale,
      rootPolicy: options.rootPolicy,
      retarget: options.retarget,
    });
  }

  async start(emit: MotionFrameEmitter): Promise<void> {
    if (this.socket) {
      return;
    }

    const socket = createSocket("udp4");
    this.state = createVmcFrameState();
    this.sequence = 0;
    this.socket = socket;
    socket.on("message", (packet: Buffer, _remote: RemoteInfo) => {
      try {
        const frame = applyVmcEvents(
          this.state,
          decodeVmcPacket(packet),
          this.profile,
          Date.now(),
        );
        if (frame) {
          frame.sequence = this.sequence++;
          frame.metadata = {
            ...frame.metadata,
            sourceId: this.id,
            clock: "unix",
          };
          emit(frame);
        }
      } catch (error) {
        console.warn(`[NodeVmcSource] ignored invalid VMC packet`, error);
      }
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          socket.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          socket.off("error", onError);
          resolve();
        };
        socket.once("error", onError);
        socket.once("listening", onListening);
        socket.bind(this.port, this.host);
      });
      socket.on("error", (error) => {
        console.error(`[NodeVmcSource] UDP socket error`, error);
      });
    } catch (error) {
      socket.close();
      this.socket = null;
      throw error;
    }
  }

  address(): AddressInfo {
    const address = this.socket?.address();
    if (!address || typeof address === "string") {
      throw new Error("VMC input source is not listening");
    }
    return address;
  }

  async stop(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    if (!socket) {
      return;
    }
    await new Promise<void>((resolve) => socket.close(() => resolve()));
  }
}
