import type { BehaviorId } from "./types.js";

export class BehaviorQueue {
  private readonly pending: BehaviorId[] = [];

  enqueue(behavior: BehaviorId): void {
    this.pending.push(behavior);
  }

  dequeue(): BehaviorId | null {
    return this.pending.shift() ?? null;
  }

  get length(): number {
    return this.pending.length;
  }

  clear(): void {
    this.pending.length = 0;
  }
}
