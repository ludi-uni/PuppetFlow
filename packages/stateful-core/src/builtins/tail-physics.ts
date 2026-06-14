import type { StatefulFunctionDefinition } from "../types.js";

const MAX_DELTA_TIME = 0.05;

export interface TailPhysicsState {
  phase: number;
  position: number;
  velocity: number;
}

export const tailPhysicsDefinition: StatefulFunctionDefinition<TailPhysicsState> = {
  name: "tailPhysics",
  createState: () => ({ phase: 0, position: 0.5, velocity: 0 }),
  update(frame, state, config) {
    const frequency = Number(config.frequency ?? 1.2);
    const amplitude = Number(config.amplitude ?? 0.45);
    const stiffness = Number(config.stiffness ?? 160);
    const damping = Number(config.damping ?? 16);
    const dt = Math.min(Math.max(frame.deltaTime, 0), MAX_DELTA_TIME);

    const phase = state.phase + frequency * dt * Math.PI * 2;
    const target = 0.5 + Math.sin(phase) * amplitude;

    const springForce = stiffness * (target - state.position);
    const dampingForce = damping * state.velocity;
    const acceleration = springForce - dampingForce;
    const velocity = state.velocity + acceleration * dt;
    const position = state.position + velocity * dt;

    return {
      value: position,
      state: { phase, position, velocity },
    };
  },
};
