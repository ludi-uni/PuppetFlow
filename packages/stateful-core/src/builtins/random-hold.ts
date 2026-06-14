import { randomInRange } from "../random.js";
import type { StatefulFunctionDefinition } from "../types.js";

export interface RandomHoldState {
  currentValue: number;
  nextChangeAt: number;
  changeIndex: number;
  initialized: boolean;
}

export const randomHoldDefinition: StatefulFunctionDefinition<RandomHoldState> = {
  name: "randomHold",
  createState: () => ({
    currentValue: 0,
    nextChangeAt: 0,
    changeIndex: 0,
    initialized: false,
  }),
  update(frame, state, config, _input) {
    const interval = Math.max(Number(config.interval ?? 3), 0.05);
    const min = Number(config.min ?? -0.3);
    const max = Number(config.max ?? 0.3);
    const instanceId = String(config.__instanceId ?? "randomHold");

    if (!state.initialized) {
      const currentValue = randomInRange(instanceId, 0, min, max);
      return {
        value: currentValue,
        state: {
          currentValue,
          nextChangeAt: frame.elapsedTime + interval,
          changeIndex: 0,
          initialized: true,
        },
      };
    }

    if (frame.elapsedTime < state.nextChangeAt) {
      return { value: state.currentValue, state };
    }

    const changeIndex = state.changeIndex + 1;
    const currentValue = randomInRange(instanceId, changeIndex, min, max);

    return {
      value: currentValue,
      state: {
        currentValue,
        nextChangeAt: frame.elapsedTime + interval,
        changeIndex,
        initialized: true,
      },
    };
  },
};
