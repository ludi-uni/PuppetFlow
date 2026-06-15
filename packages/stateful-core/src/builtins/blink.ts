import { randomInRange } from "../random.js";
import type { StatefulFunctionDefinition } from "../types.js";

const DEFAULT_CLOSE_DURATION = 0.12;

export interface BlinkState {
  nextBlinkAt: number;
  blinkEndAt: number;
  blinkIndex: number;
  initialized: boolean;
}

function blinkCloseAmount(
  elapsedTime: number,
  blinkStart: number,
  closeDuration: number,
): number {
  const progress = (elapsedTime - blinkStart) / closeDuration;
  if (progress <= 0 || progress >= 1) {
    return 0;
  }
  return progress < 0.5 ? progress * 2 : (1 - progress) * 2;
}

export const blinkDefinition: StatefulFunctionDefinition<BlinkState> = {
  name: "blink",
  createState: () => ({
    nextBlinkAt: 0,
    blinkEndAt: 0,
    blinkIndex: 0,
    initialized: false,
  }),
  update(frame, state, config) {
    const averageInterval = Math.max(Number(config.averageInterval ?? 4), 0.5);
    const closeDuration = Math.max(
      Number(config.closeDuration ?? DEFAULT_CLOSE_DURATION),
      0.05,
    );
    const instanceId = String(config.__instanceId ?? "blink");

    if (!state.initialized) {
      const firstDelay =
        averageInterval * (0.7 + randomInRange(instanceId, 0, 0, 1) * 0.6);
      return {
        value: 0,
        state: {
          nextBlinkAt: frame.elapsedTime + firstDelay,
          blinkEndAt: 0,
          blinkIndex: 0,
          initialized: true,
        },
      };
    }

    let { nextBlinkAt, blinkEndAt, blinkIndex } = state;

    if (blinkEndAt > frame.elapsedTime) {
      const blinkStart = blinkEndAt - closeDuration;
      return {
        value: blinkCloseAmount(frame.elapsedTime, blinkStart, closeDuration),
        state,
      };
    }

    if (frame.elapsedTime >= nextBlinkAt) {
      blinkIndex += 1;
      blinkEndAt = frame.elapsedTime + closeDuration;
      const interval =
        averageInterval * (0.7 + randomInRange(instanceId, blinkIndex, 0, 1) * 0.6);
      nextBlinkAt = frame.elapsedTime + interval;
      return {
        value: blinkCloseAmount(frame.elapsedTime, frame.elapsedTime, closeDuration),
        state: { nextBlinkAt, blinkEndAt, blinkIndex, initialized: true },
      };
    }

    return {
      value: 0,
      state: { nextBlinkAt, blinkEndAt: 0, blinkIndex, initialized: true },
    };
  },
};
