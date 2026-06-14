export type {
  FrameContext,
  StatefulEntrySnapshot,
  StatefulFunctionDefinition,
  StatefulRegistry,
  StatefulUpdateResult,
  StatefulValue,
} from "./types.js";
export { createStatefulRegistry } from "./registry.js";
export { StatefulStore } from "./store.js";
export {
  BUILTIN_STATEFUL_FUNCTIONS,
  blinkDefinition,
  breathDefinition,
  cooldownDefinition,
  earPhysicsDefinition,
  oscillatorDefinition,
  randomHoldDefinition,
  smoothDefinition,
  springDefinition,
  tailPhysicsDefinition,
  wanderDefinition,
  type BlinkState,
  type BreathState,
  type CooldownState,
  type EarPhysicsState,
  type OscillatorState,
  type RandomHoldState,
  type SmoothState,
  type SpringState,
  type TailPhysicsState,
  type WanderState,
} from "./builtins/index.js";
export { callStatefulFunction, evaluateStatefulGraphNode } from "./call.js";
export {
  createStatefulPlugin,
  registerStatefulPlugins,
  type StatefulNodePlugin,
} from "./plugin.js";
export {
  extensionFrame,
  runStatefulNumber,
  type StatefulExtensionContext,
} from "./extension-helper.js";
export {
  BUNDLED_PHYSICS_STATEFUL_PLUGINS,
  earPhysicsPlugin,
  tailPhysicsPlugin,
} from "./physics-plugins.js";

import { BUILTIN_STATEFUL_FUNCTIONS } from "./builtins/index.js";
import { createStatefulRegistry } from "./registry.js";
import { BUNDLED_PHYSICS_STATEFUL_PLUGINS } from "./physics-plugins.js";
import { registerStatefulPlugins } from "./plugin.js";

export function createDefaultStatefulRegistry() {
  return createStatefulRegistry(BUILTIN_STATEFUL_FUNCTIONS);
}

export function createRuntimeStatefulRegistry() {
  const registry = createDefaultStatefulRegistry();
  registerStatefulPlugins(registry, BUNDLED_PHYSICS_STATEFUL_PLUGINS);
  return registry;
}
