import type { StatefulFunctionDefinition } from "../types.js";

export interface SmoothState {
  current: number;
  initialized: boolean;
}

export const smoothDefinition: StatefulFunctionDefinition<SmoothState> = {
  name: "smooth",
  createState: () => ({ current: 0, initialized: false }),
  update(frame, state, config, input) {
    const speed = Number(config.speed ?? 2);
    const alpha = 1 - Math.exp(-speed * frame.deltaTime);
    const current = state.initialized
      ? state.current + (input - state.current) * alpha
      : input;

    return {
      value: current,
      state: { current, initialized: true },
    };
  },
};
