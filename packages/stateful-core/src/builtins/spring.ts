import type { StatefulFunctionDefinition } from "../types.js";

const MAX_DELTA_TIME = 0.05;

export interface SpringState {
  position: number;
  velocity: number;
}

export const springDefinition: StatefulFunctionDefinition<SpringState> = {
  name: "spring",
  createState: () => ({ position: 0, velocity: 0 }),
  update(frame, state, config, input) {
    const stiffness = Number(config.stiffness ?? 180);
    const damping = Number(config.damping ?? 18);
    const dt = Math.min(Math.max(frame.deltaTime, 0), MAX_DELTA_TIME);
    const target = input;

    const springForce = stiffness * (target - state.position);
    const dampingForce = damping * state.velocity;
    const acceleration = springForce - dampingForce;
    const velocity = state.velocity + acceleration * dt;
    const position = state.position + velocity * dt;

    return {
      value: position,
      state: { position, velocity },
    };
  },
};
