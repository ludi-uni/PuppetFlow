import type { BehaviorId } from "./types.js";

export class CooldownTracker {
  private readonly lastExecutedAt = new Map<BehaviorId, number>();

  canExecute(behavior: BehaviorId, cooldownSeconds: number, now: number): boolean {
    const last = this.lastExecutedAt.get(behavior);
    if (last === undefined) {
      return true;
    }
    return now - last >= cooldownSeconds;
  }

  markExecuted(behavior: BehaviorId, now: number): void {
    this.lastExecutedAt.set(behavior, now);
  }

  getRemainingSeconds(
    behavior: BehaviorId,
    cooldownSeconds: number,
    now: number,
  ): number {
    const last = this.lastExecutedAt.get(behavior);
    if (last === undefined) {
      return 0;
    }
    return Math.max(0, cooldownSeconds - (now - last));
  }

  snapshot(
    now: number,
    cooldowns: Record<string, number>,
  ): Array<{
    behavior: BehaviorId;
    remainingSeconds: number;
  }> {
    return Object.entries(cooldowns).flatMap(([behavior, seconds]) => {
      const remaining = this.getRemainingSeconds(behavior, seconds, now);
      return remaining > 0 ? [{ behavior, remainingSeconds: remaining }] : [];
    });
  }
}
