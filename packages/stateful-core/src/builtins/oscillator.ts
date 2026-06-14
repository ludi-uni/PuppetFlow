import type { StatefulFunctionDefinition } from "../types.js";

export interface OscillatorState {
  phase: number;
}

export const oscillatorDefinition: StatefulFunctionDefinition<OscillatorState> = {
  name: "oscillator",
  createState: () => ({ phase: 0 }),
  update(frame, state, config) {
    const frequency = Number(config.frequency ?? 0.5);
    const phaseOffset = Number(config.phaseOffset ?? 0);
    const phase = state.phase + frequency * frame.deltaTime * Math.PI * 2;
    return {
      value: Math.sin(phase + phaseOffset),
      state: { phase },
    };
  },
};
