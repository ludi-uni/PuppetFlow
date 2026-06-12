import type { MotionState } from "@puppetflow/core";

export interface Adapter {
  readonly id: string;
  initialize(): Promise<void>;
  update(motion: MotionState, deltaTime: number): Promise<void>;
  dispose(): Promise<void>;
}

/** @deprecated Use `Adapter` from `@puppetflow/adapter-core` instead. */
export interface LegacyAdapter {
  update(motion: MotionState): void | Promise<void>;
}

export function wrapLegacyAdapter(id: string, legacy: LegacyAdapter): Adapter {
  return {
    id,
    async initialize() {},
    async update(motion, _deltaTime) {
      await legacy.update(motion);
    },
    async dispose() {},
  };
}
