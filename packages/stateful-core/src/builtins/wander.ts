import { randomInRange } from "../random.js";
import type { StatefulFunctionDefinition } from "../types.js";

export interface WanderState {
  value: number;
  target: number;
  nextChangeAt: number;
  changeIndex: number;
  initialized: boolean;
}

export const wanderDefinition: StatefulFunctionDefinition<WanderState> = {
  name: "wander",
  createState: () => ({
    value: 0,
    target: 0,
    nextChangeAt: 0,
    changeIndex: 0,
    initialized: false,
  }),
  update(frame, state, config) {
    const speed = Math.max(Number(config.speed ?? 0.2), 0.01);
    const instanceId = String(config.__instanceId ?? "wander");
    const changeInterval = 2 / speed;
    const blend = 1 - Math.exp(-speed * 4 * frame.deltaTime);

    if (!state.initialized) {
      const target = randomInRange(instanceId, 0, -1, 1);
      return {
        value: target * 0.25,
        state: {
          value: target * 0.25,
          target,
          nextChangeAt: frame.elapsedTime + changeInterval,
          changeIndex: 0,
          initialized: true,
        },
      };
    }

    let { value, target, nextChangeAt, changeIndex } = state;

    if (frame.elapsedTime >= nextChangeAt) {
      changeIndex += 1;
      target = randomInRange(instanceId, changeIndex, -1, 1);
      nextChangeAt = frame.elapsedTime + changeInterval;
    }

    value += (target - value) * blend;

    return {
      value,
      state: { value, target, nextChangeAt, changeIndex, initialized: true },
    };
  },
};
