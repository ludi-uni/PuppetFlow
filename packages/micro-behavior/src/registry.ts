import type {
  MicroBehaviorDefinition,
  MicroBehaviorId,
  MicroBehaviorKeyframe,
  MicroBehaviorRequest,
} from "./types.js";
import { MICRO_BEHAVIOR_IDS } from "./types.js";

const BUILTIN_DEFINITIONS: Record<MicroBehaviorId, MicroBehaviorDefinition> = {
  look_up: {
    id: "look_up",
    duration: 1.2,
    cooldown: 5,
    keyframes: [
      { t: 0, params: { eyeY: 0 } },
      { t: 0.2, params: { eyeY: 0.4 } },
      { t: 0.8, params: { eyeY: 0.4 } },
      { t: 1.2, params: { eyeY: 0 } },
    ],
    paramRandom: {
      eyeY: { min: 0.35, max: 0.45 },
    },
    durationRandom: { min: 1.0, max: 1.4 },
  },
  look_left: {
    id: "look_left",
    duration: 1.0,
    cooldown: 5,
    keyframes: [
      { t: 0, params: { lookX: 0.5 } },
      { t: 0.25, params: { lookX: 0.78 } },
      { t: 0.75, params: { lookX: 0.78 } },
      { t: 1.0, params: { lookX: 0.5 } },
    ],
    paramRandom: {
      lookX: { min: 0.72, max: 0.84 },
    },
    durationRandom: { min: 0.9, max: 1.1 },
  },
  look_right: {
    id: "look_right",
    duration: 1.0,
    cooldown: 5,
    keyframes: [
      { t: 0, params: { lookX: 0.5 } },
      { t: 0.25, params: { lookX: 0.22 } },
      { t: 0.75, params: { lookX: 0.22 } },
      { t: 1.0, params: { lookX: 0.5 } },
    ],
    paramRandom: {
      lookX: { min: 0.16, max: 0.28 },
    },
    durationRandom: { min: 0.9, max: 1.1 },
  },
  head_tilt: {
    id: "head_tilt",
    duration: 4.0,
    cooldown: 8,
    keyframes: [
      { t: 0, params: { headTilt: 0, faceYaw: 0 } },
      { t: 1.8, params: { headTilt: 0.15, faceYaw: 0.08 } },
      { t: 3.0, params: { headTilt: 0.15, faceYaw: 0.08 } },
      { t: 4.0, params: { headTilt: 0, faceYaw: 0 } },
    ],
    paramRandom: {
      headTilt: { min: 0.12, max: 0.18 },
      faceYaw: { min: 0.06, max: 0.1 },
    },
    durationRandom: { min: 3.8, max: 4.2 },
  },
  small_nod: {
    id: "small_nod",
    duration: 0.8,
    cooldown: 3,
    keyframes: [
      { t: 0, params: { facePitch: 0 } },
      { t: 0.15, params: { facePitch: 0.1 } },
      { t: 0.35, params: { facePitch: 0 } },
      { t: 0.55, params: { facePitch: 0.06 } },
      { t: 0.8, params: { facePitch: 0 } },
    ],
    paramRandom: {
      facePitch: { min: 0.08, max: 0.12 },
    },
    durationRandom: { min: 0.7, max: 0.9 },
  },
  long_blink: {
    id: "long_blink",
    duration: 0.5,
    cooldown: 2,
    keyframes: [
      { t: 0, params: { eyeOpen: 1.0 } },
      { t: 0.12, params: { eyeOpen: 0.0 } },
      { t: 0.28, params: { eyeOpen: 0.0 } },
      { t: 0.4, params: { eyeOpen: 1.15 } },
      { t: 0.5, params: { eyeOpen: 1.0 } },
    ],
    durationRandom: { min: 0.45, max: 0.6 },
  },
};

export class BehaviorRegistry {
  private readonly custom = new Map<string, MicroBehaviorDefinition>();

  resolve(id: string): MicroBehaviorDefinition | null {
    if (id in BUILTIN_DEFINITIONS) {
      return BUILTIN_DEFINITIONS[id as MicroBehaviorId];
    }
    return this.custom.get(id) ?? null;
  }

  register(definition: MicroBehaviorDefinition): void {
    if (definition.id in BUILTIN_DEFINITIONS) {
      throw new Error(`Cannot override built-in behavior: ${definition.id}`);
    }
    this.custom.set(definition.id, definition);
  }

  has(id: string): boolean {
    return id in BUILTIN_DEFINITIONS || this.custom.has(id);
  }

  listAll(): MicroBehaviorDefinition[] {
    return [...Object.values(BUILTIN_DEFINITIONS), ...this.custom.values()];
  }

  listCustom(): MicroBehaviorDefinition[] {
    return [...this.custom.values()];
  }

  clearCustom(): void {
    this.custom.clear();
  }
}

const defaultRegistry = new BehaviorRegistry();

export function getBehaviorDefinition(id: string): MicroBehaviorDefinition {
  const definition = defaultRegistry.resolve(id);
  if (!definition) {
    throw new Error(`Unknown behavior: ${id}`);
  }
  return definition;
}

export function listBehaviorDefinitions(): MicroBehaviorDefinition[] {
  return defaultRegistry.listAll();
}

export function isMicroBehaviorId(value: string): value is MicroBehaviorId {
  return value in BUILTIN_DEFINITIONS;
}

export function isKnownBehaviorId(value: string): boolean {
  return defaultRegistry.has(value);
}

export function registerCustomBehaviorDefinition(
  definition: MicroBehaviorDefinition,
): void {
  defaultRegistry.register(definition);
}

export function createBehaviorRegistry(): BehaviorRegistry {
  return new BehaviorRegistry();
}

export { BUILTIN_DEFINITIONS };
