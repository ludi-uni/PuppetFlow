import type { MotionStateKey } from "@puppetflow/core";

import { CooldownTracker } from "./cooldown.js";
import { collectBehaviorActiveKeys, sampleBehaviorAtTime } from "./executor.js";
import {
  createBehaviorRegistry,
  type BehaviorRegistry as BehaviorRegistryType,
} from "./registry.js";
import { BehaviorQueue } from "./queue.js";
import {
  applyDurationRandomization,
  applyKeyframeRandomization,
  scaleKeyframesToDuration,
} from "./randomize.js";
import {
  canResolveBehaviorRequest,
  parseBehaviorInputPayload,
} from "./parse-behavior-input.js";
import type {
  MicroBehaviorDefinition,
  MicroBehaviorEngineOptions,
  MicroBehaviorQueueStatus,
  MicroBehaviorRequest,
  MicroBehaviorSnapshot,
  MicroBehaviorStatus,
  MicroBehaviorTickResult,
} from "./types.js";

interface ActiveBehaviorInstance {
  id: string;
  keyframes: ReturnType<typeof applyKeyframeRandomization>;
  duration: number;
  elapsed: number;
  strength: number;
  activeKeys: MotionStateKey[];
}

export class MicroBehaviorEngine {
  private readonly registry: BehaviorRegistryType;
  private readonly queue = new BehaviorQueue();
  private readonly cooldowns = new CooldownTracker();
  private readonly random: () => number;
  private active: ActiveBehaviorInstance | null = null;
  private clock = 0;

  constructor(options: MicroBehaviorEngineOptions = {}) {
    this.random = options.random ?? Math.random;
    this.registry = options.registry ?? createBehaviorRegistry();
  }

  registerDefinition(definition: MicroBehaviorDefinition): void {
    this.registry.register(definition);
  }

  /** Replace all custom definitions (built-ins are unchanged). */
  setCustomDefinitions(definitions: readonly MicroBehaviorDefinition[]): void {
    this.registry.clearCustom();
    for (const definition of definitions) {
      this.registry.register(definition);
    }
  }

  hasBehavior(id: string): boolean {
    return this.registry.has(id);
  }

  listDefinitions(): MicroBehaviorDefinition[] {
    return this.registry.listAll();
  }

  applyFromInputRecord(record: Record<string, unknown>): boolean {
    const request = parseBehaviorInputPayload(record);
    if (!request) {
      return false;
    }
    return this.request(request);
  }

  applyFromInputPayload(payload: unknown): boolean {
    if (typeof payload !== "object" || payload === null) {
      return false;
    }
    return this.applyFromInputRecord(payload as Record<string, unknown>);
  }

  request(request: MicroBehaviorRequest): boolean {
    if (!canResolveBehaviorRequest(request, (id) => this.registry.has(id))) {
      return false;
    }

    if (request.definition) {
      this.registry.register(request.definition);
    }

    const definition = this.registry.resolve(request.behavior);
    if (!definition) {
      return false;
    }

    const strength = request.strength ?? 1;
    const behavior = request.behavior;

    if (!this.cooldowns.canExecute(behavior, definition.cooldown, this.clock)) {
      return false;
    }

    if (this.active) {
      this.queue.enqueue(behavior);
      return true;
    }

    this.startBehavior(behavior, strength);
    return true;
  }

  tick(deltaTime: number): MicroBehaviorTickResult | null {
    this.clock += deltaTime;

    if (!this.active) {
      this.tryStartQueued();
      if (!this.active) {
        return null;
      }
    }

    const instance = this.active;
    instance.elapsed += deltaTime;
    const sampled = sampleBehaviorAtTime(
      instance.keyframes,
      Math.min(instance.elapsed, instance.duration),
      instance.strength,
    );

    const result: MicroBehaviorTickResult = {
      motion: sampled.motion,
      activeKeys: instance.activeKeys,
      customKeys: [],
    };

    if (instance.elapsed >= instance.duration) {
      this.active = null;
      this.tryStartQueued();
    }

    return result;
  }

  isActive(): boolean {
    return this.active !== null;
  }

  getActiveKeys(): readonly MotionStateKey[] {
    return this.active?.activeKeys ?? [];
  }

  getStatus(): MicroBehaviorStatus {
    if (!this.active) {
      return { activeBehavior: null, remaining: 0 };
    }

    return {
      activeBehavior: this.active.id,
      remaining: Math.max(0, this.active.duration - this.active.elapsed),
    };
  }

  getQueueStatus(): MicroBehaviorQueueStatus {
    return { queueLength: this.queue.length };
  }

  getSnapshot(): MicroBehaviorSnapshot {
    const cooldownMap = Object.fromEntries(
      this.registry.listAll().map((definition) => [definition.id, definition.cooldown]),
    );

    return {
      status: this.getStatus(),
      queue: this.getQueueStatus(),
      cooldowns: this.cooldowns.snapshot(this.clock, cooldownMap),
    };
  }

  reset(): void {
    this.active = null;
    this.queue.clear();
    this.clock = 0;
  }

  private tryStartQueued(): void {
    if (this.active) {
      return;
    }

    while (true) {
      const next = this.queue.dequeue();
      if (!next) {
        return;
      }

      const definition = this.registry.resolve(next);
      if (!definition) {
        continue;
      }

      if (!this.cooldowns.canExecute(next, definition.cooldown, this.clock)) {
        continue;
      }

      this.startBehavior(next, 1);
      return;
    }
  }

  private startBehavior(behavior: string, strength: number): void {
    const definition = this.registry.resolve(behavior);
    if (!definition) {
      return;
    }

    const duration = applyDurationRandomization(definition, this.random);
    const keyframes = scaleKeyframesToDuration(
      applyKeyframeRandomization(definition, this.random),
      definition.duration,
      duration,
    );

    this.active = {
      id: behavior,
      keyframes,
      duration,
      elapsed: 0,
      strength,
      activeKeys: collectBehaviorActiveKeys(keyframes),
    };

    this.cooldowns.markExecuted(behavior, this.clock);
  }
}
