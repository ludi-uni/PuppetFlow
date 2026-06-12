import type { Adapter } from "@puppetflow/adapter-core";
import type { MotionState } from "@puppetflow/core";
import {
  mapMotion,
  VMC_PROFILE,
  type MotionMapperProfile,
} from "@puppetflow/motion-mapper";
import { DEFAULT_VMC_HOST, DEFAULT_VMC_PORT } from "./types.js";

export interface TauriOscAdapterConfig {
  id?: string;
  host?: string;
  port?: number;
  profile?: MotionMapperProfile;
}

let tauriOscEnabled = true;

export function setTauriOscEnabled(enabled: boolean): void {
  tauriOscEnabled = enabled;
}

export function isTauriOscEnabled(): boolean {
  return tauriOscEnabled;
}

export class TauriOscAdapter implements Adapter {
  readonly id: string;
  private readonly host: string;
  private readonly port: number;
  private readonly profile: MotionMapperProfile;

  constructor(config: TauriOscAdapterConfig = {}) {
    this.id = config.id ?? "osc-tauri";
    this.host = config.host ?? DEFAULT_VMC_HOST;
    this.port = config.port ?? DEFAULT_VMC_PORT;
    this.profile = config.profile ?? VMC_PROFILE;
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
      await invoke("osc_send_blend_params", {
        host: this.host,
        port: this.port,
        params: mapMotion(motion, this.profile),
      });
    } catch (error) {
      console.error(`[${this.id}] OSC send failed`, error);
    }
  }

  async dispose(): Promise<void> {}
}
