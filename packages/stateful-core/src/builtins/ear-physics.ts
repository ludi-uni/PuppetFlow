import { randomInRange } from "../random.js";
import type { StatefulFunctionDefinition } from "../types.js";

const MAX_DELTA_TIME = 0.05;

export interface EarPhysicsState {
  holdValue: number;
  nextHoldAt: number;
  holdIndex: number;
  position: number;
  velocity: number;
  initialized: boolean;
}

export const earPhysicsDefinition: StatefulFunctionDefinition<EarPhysicsState> = {
  name: "earPhysics",
  createState: () => ({
    holdValue: 0.5,
    nextHoldAt: 0,
    holdIndex: 0,
    position: 0.5,
    velocity: 0,
    initialized: false,
  }),
  update(frame, state, config) {
    const intensity = Number(config.intensity ?? 0.4);
    const stiffness = Number(config.stiffness ?? 120);
    const damping = Number(config.damping ?? 14);
    const holdInterval = Number(config.holdInterval ?? 0.8);
    const instanceId = String(config.__instanceId ?? "earPhysics");
    const dt = Math.min(Math.max(frame.deltaTime, 0), MAX_DELTA_TIME);

    let {
      holdValue,
      nextHoldAt,
      holdIndex,
      position,
      velocity,
      initialized,
    } = state;

    if (!initialized) {
      holdValue = randomInRange(instanceId, 0, 0.5 - intensity * 0.2, 0.5 + intensity * 0.2);
      nextHoldAt = frame.elapsedTime + holdInterval;
      initialized = true;
    } else if (frame.elapsedTime >= nextHoldAt) {
      holdIndex += 1;
      holdValue = randomInRange(
        instanceId,
        holdIndex,
        0.5 - intensity * 0.35,
        0.5 + intensity * 0.35,
      );
      nextHoldAt = frame.elapsedTime + holdInterval;
    }

    const springForce = stiffness * (holdValue - position);
    const dampingForce = damping * velocity;
    const acceleration = springForce - dampingForce;
    velocity = velocity + acceleration * dt;
    position = position + velocity * dt;

    return {
      value: position,
      state: {
        holdValue,
        nextHoldAt,
        holdIndex,
        position,
        velocity,
        initialized,
      },
    };
  },
};
