import {
  clamp01,
  migrateLegacyMotionKey,
  MOTION_STATE_KEYS,
  type MotionState,
  type MotionStateKey,
} from "@puppetflow/core";

export const MAX_MOTION_KEYS_PER_PAYLOAD = 128;

function isMotionStateKey(key: string): key is MotionStateKey {
  return (MOTION_STATE_KEYS as readonly string[]).includes(key);
}

export class MotionOverrideStore {
  private readonly standard = new Map<MotionStateKey, number>();
  private readonly custom = new Map<string, number>();

  applyPayload(payload: unknown, fieldMapping: Record<string, string> = {}): void {
    if (typeof payload !== "object" || payload === null) {
      throw new Error("Motion payload must be a JSON object");
    }

    const record = payload as Record<string, unknown>;
    let keyCount = 0;

    for (const [rawKey, value] of Object.entries(record)) {
      if (rawKey === "custom") {
        if (typeof value !== "object" || value === null) {
          continue;
        }

        for (const [customKey, customValue] of Object.entries(value)) {
          if (typeof customValue !== "number") {
            continue;
          }
          if (++keyCount > MAX_MOTION_KEYS_PER_PAYLOAD) {
            throw new Error(`motion exceeds max keys (${MAX_MOTION_KEYS_PER_PAYLOAD})`);
          }
          this.custom.set(customKey, clamp01(customValue));
        }
        continue;
      }

      if (typeof value !== "number") {
        continue;
      }

      const mappedKey = fieldMapping[rawKey] ?? rawKey;
      const { key } = migrateLegacyMotionKey(mappedKey);
      if (!isMotionStateKey(key)) {
        continue;
      }

      if (++keyCount > MAX_MOTION_KEYS_PER_PAYLOAD) {
        throw new Error(`motion exceeds max keys (${MAX_MOTION_KEYS_PER_PAYLOAD})`);
      }

      this.standard.set(key, clamp01(value));
    }
  }

  applyTo(motion: MotionState): MotionState {
    if (!this.hasOverrides()) {
      return motion;
    }

    const result: MotionState = {
      ...motion,
      custom: { ...motion.custom },
    };

    for (const [key, value] of this.standard) {
      result[key] = value;
    }

    for (const [key, value] of this.custom) {
      result.custom[key] = value;
    }

    return result;
  }

  hasOverrides(): boolean {
    return this.standard.size > 0 || this.custom.size > 0;
  }

  clear(): void {
    this.standard.clear();
    this.custom.clear();
  }
}
