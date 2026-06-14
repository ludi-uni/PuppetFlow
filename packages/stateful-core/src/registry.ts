import type { StatefulFunctionDefinition, StatefulRegistry } from "./types.js";

export function createStatefulRegistry(
  builtins: StatefulFunctionDefinition[] = [],
): StatefulRegistry {
  const functions = new Map<string, StatefulFunctionDefinition>();

  for (const def of builtins) {
    functions.set(def.name, def);
  }

  return {
    register(def) {
      functions.set(def.name, def);
    },
    get(name) {
      return functions.get(name);
    },
    names() {
      return [...functions.keys()];
    },
  };
}
