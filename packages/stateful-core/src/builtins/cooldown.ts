import type { StatefulFunctionDefinition } from "../types.js";

export interface CooldownState {
  lastAllowedAt: number;
}

export const cooldownDefinition: StatefulFunctionDefinition<CooldownState> = {
  name: "cooldown",
  createState: () => ({ lastAllowedAt: Number.NEGATIVE_INFINITY }),
  update(frame, state, config) {
    const duration = Math.max(Number(config.duration ?? 3), 0.05);
    const allowed = frame.elapsedTime - state.lastAllowedAt >= duration;

    if (allowed) {
      return {
        value: true,
        state: { lastAllowedAt: frame.elapsedTime },
      };
    }

    return { value: false, state };
  },
};
