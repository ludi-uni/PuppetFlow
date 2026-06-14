import { createStatefulPlugin } from "./plugin.js";
import { earPhysicsDefinition } from "./builtins/ear-physics.js";
import { tailPhysicsDefinition } from "./builtins/tail-physics.js";

export const tailPhysicsPlugin = createStatefulPlugin("tailPhysics", [tailPhysicsDefinition]);
export const earPhysicsPlugin = createStatefulPlugin("earPhysics", [earPhysicsDefinition]);

export const BUNDLED_PHYSICS_STATEFUL_PLUGINS = [tailPhysicsPlugin, earPhysicsPlugin];
