import { blinkDefinition } from "./blink.js";
import { breathDefinition } from "./breath.js";
import { cooldownDefinition } from "./cooldown.js";
import { earPhysicsDefinition } from "./ear-physics.js";
import { oscillatorDefinition } from "./oscillator.js";
import { randomHoldDefinition } from "./random-hold.js";
import { smoothDefinition } from "./smooth.js";
import { springDefinition } from "./spring.js";
import { tailPhysicsDefinition } from "./tail-physics.js";
import { wanderDefinition } from "./wander.js";

export { blinkDefinition, type BlinkState } from "./blink.js";
export { breathDefinition, type BreathState } from "./breath.js";
export { wanderDefinition, type WanderState } from "./wander.js";
export { cooldownDefinition, type CooldownState } from "./cooldown.js";
export { tailPhysicsDefinition, type TailPhysicsState } from "./tail-physics.js";
export { earPhysicsDefinition, type EarPhysicsState } from "./ear-physics.js";
export { oscillatorDefinition, type OscillatorState } from "./oscillator.js";
export { smoothDefinition, type SmoothState } from "./smooth.js";
export { springDefinition, type SpringState } from "./spring.js";
export { randomHoldDefinition, type RandomHoldState } from "./random-hold.js";

export const BUILTIN_STATEFUL_FUNCTIONS = [
  oscillatorDefinition,
  smoothDefinition,
  springDefinition,
  randomHoldDefinition,
  blinkDefinition,
  breathDefinition,
  wanderDefinition,
  cooldownDefinition,
];
