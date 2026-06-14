import type { StatefulFunctionDefinition, StatefulRegistry } from "./types.js";

export interface StatefulNodePlugin {
  id: string;
  register(registry: StatefulRegistry): void;
}

export function registerStatefulPlugins(
  registry: StatefulRegistry,
  plugins: StatefulNodePlugin[],
): void {
  for (const plugin of plugins) {
    plugin.register(registry);
  }
}

export function createStatefulPlugin(
  id: string,
  definitions: StatefulFunctionDefinition[],
): StatefulNodePlugin {
  return {
    id,
    register(registry) {
      for (const def of definitions) {
        registry.register(def);
      }
    },
  };
}
