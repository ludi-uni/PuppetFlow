import type { StatefulFunctionDefinition } from "../types.js";

export interface BreathState {
  phase: number;
}

function breathWave(phase: number): number {
  const t = (phase % (Math.PI * 2)) / (Math.PI * 2);
  if (t < 0.45) {
    const inhale = t / 0.45;
    return inhale * inhale * (3 - 2 * inhale);
  }
  const exhale = (t - 0.45) / 0.55;
  return 1 - exhale * Math.sqrt(exhale);
}

export const breathDefinition: StatefulFunctionDefinition<BreathState> = {
  name: "breath",
  createState: () => ({ phase: 0 }),
  update(frame, state, config) {
    const rate = Math.max(Number(config.rate ?? 0.25), 0.05);
    const phase = state.phase + rate * frame.deltaTime * Math.PI * 2;
    const wave = breathWave(phase);
    return {
      value: wave * 0.85 + 0.075,
      state: { phase },
    };
  },
};
