import type {
  MotionFunctionDefinition,
  MotionGeneratorDefinition,
  MotionNodeDefinition,
  MotionPackDefinition,
  MotionRegistry,
  ParameterDefinition,
  TimelineGeneratorDefinition,
} from "./types.js";

export class MotionRegistryImpl implements MotionRegistry {
  readonly parameters = new Map<string, ParameterDefinition>();
  readonly packs = new Map<string, MotionPackDefinition>();
  readonly functions = new Map<string, MotionFunctionDefinition>();
  readonly nodes = new Map<string, MotionNodeDefinition>();
  readonly generators = new Map<string, MotionGeneratorDefinition>();
  readonly timelineGenerators = new Map<string, TimelineGeneratorDefinition>();

  addParameter(def: ParameterDefinition): void {
    if (this.parameters.has(def.id)) {
      throw new Error(`Parameter already registered: ${def.id}`);
    }
    this.parameters.set(def.id, def);
  }

  addPack(def: MotionPackDefinition): void {
    if (this.packs.has(def.id)) {
      throw new Error(`Motion pack already registered: ${def.id}`);
    }
    this.packs.set(def.id, def);
  }

  addFunction(def: MotionFunctionDefinition): void {
    if (this.functions.has(def.name)) {
      throw new Error(`Function already registered: ${def.name}`);
    }
    this.functions.set(def.name, def);
  }

  addNode(def: MotionNodeDefinition): void {
    if (this.nodes.has(def.type)) {
      throw new Error(`Node already registered: ${def.type}`);
    }
    this.nodes.set(def.type, def);
  }

  addGenerator(def: MotionGeneratorDefinition): void {
    if (this.generators.has(def.id)) {
      throw new Error(`Generator already registered: ${def.id}`);
    }
    this.generators.set(def.id, def);
  }

  addTimelineGenerator(def: TimelineGeneratorDefinition): void {
    if (this.timelineGenerators.has(def.id)) {
      throw new Error(`Timeline generator already registered: ${def.id}`);
    }
    this.timelineGenerators.set(def.id, def);
  }
}

export function createMotionRegistry(): MotionRegistryImpl {
  return new MotionRegistryImpl();
}

export function registerExtensionPlugins(
  registry: MotionRegistryImpl,
  plugins: Array<{ register(reg: MotionRegistry): void }>,
): void {
  for (const plugin of plugins) {
    plugin.register(registry);
  }
}

export function createDefaultCustomValues(
  registry: MotionRegistryImpl,
  overrides: Record<string, number> = {},
): Record<string, number> {
  const custom: Record<string, number> = {};

  for (const [id, def] of registry.parameters) {
    custom[id] = overrides[id] ?? def.defaultValue;
  }

  for (const [id, value] of Object.entries(overrides)) {
    if (!(id in custom)) {
      custom[id] = value;
    }
  }

  return custom;
}

export function normalizePackConfig(
  pack: MotionPackDefinition,
  raw: Record<string, unknown> | undefined,
): Record<string, number> {
  const config: Record<string, number> = {};

  for (const field of pack.configFields ?? []) {
    config[field.key] = field.default;
  }

  if (!raw) {
    return config;
  }

  for (const field of pack.configFields ?? []) {
    const value = raw[field.key];
    if (typeof value === "number" && Number.isFinite(value)) {
      const min = field.min ?? 0;
      const max = field.max ?? 1;
      config[field.key] = Math.min(max, Math.max(min, value));
    }
  }

  return config;
}
