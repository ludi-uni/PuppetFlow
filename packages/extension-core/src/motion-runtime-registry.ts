import type { MotionFrameAdapter } from "@puppetflow/adapter-core";
import type { MotionFrameFilter } from "@puppetflow/motion-pipeline";
import type { MotionSource } from "@puppetflow/source-core";

export type MotionRuntimeFactoryConfig = Readonly<Record<string, unknown>>;

export interface MotionSourceFactoryDefinition {
  type: string;
  create(config: MotionRuntimeFactoryConfig): MotionSource;
}

export interface MotionFilterFactoryDefinition {
  type: string;
  create(config: MotionRuntimeFactoryConfig): MotionFrameFilter;
}

export interface MotionFrameAdapterFactoryDefinition {
  type: string;
  create(config: MotionRuntimeFactoryConfig): MotionFrameAdapter;
}

export interface MotionRuntimePlugin {
  id: string;
  register(registry: MotionRuntimeRegistry): void;
}

export interface MotionRuntimeRegistry {
  addSourceFactory(definition: MotionSourceFactoryDefinition): void;
  addFilterFactory(definition: MotionFilterFactoryDefinition): void;
  addFrameAdapterFactory(definition: MotionFrameAdapterFactoryDefinition): void;
  createSource(type: string, config: MotionRuntimeFactoryConfig): MotionSource;
  createFilter(type: string, config: MotionRuntimeFactoryConfig): MotionFrameFilter;
  createFrameAdapter(
    type: string,
    config: MotionRuntimeFactoryConfig,
  ): MotionFrameAdapter;
}

function addFactory<T extends { type: string }>(
  factories: Map<string, T>,
  capability: string,
  definition: T,
): void {
  const type = definition.type.trim();
  if (!type) throw new Error(`${capability} factory type must be non-empty`);
  if (factories.has(type))
    throw new Error(`${capability} factory already registered: ${type}`);
  factories.set(type, { ...definition, type });
}

function requireFactory<T>(
  factories: ReadonlyMap<string, T>,
  capability: string,
  type: string,
): T {
  const factory = factories.get(type);
  if (!factory) throw new Error(`Unknown ${capability} factory: ${type}`);
  return factory;
}

export class MotionRuntimeRegistryImpl implements MotionRuntimeRegistry {
  private readonly sourceFactories = new Map<string, MotionSourceFactoryDefinition>();
  private readonly filterFactories = new Map<string, MotionFilterFactoryDefinition>();
  private readonly frameAdapterFactories = new Map<
    string,
    MotionFrameAdapterFactoryDefinition
  >();

  addSourceFactory(definition: MotionSourceFactoryDefinition): void {
    addFactory(this.sourceFactories, "motion source", definition);
  }

  addFilterFactory(definition: MotionFilterFactoryDefinition): void {
    addFactory(this.filterFactories, "motion filter", definition);
  }

  addFrameAdapterFactory(definition: MotionFrameAdapterFactoryDefinition): void {
    addFactory(this.frameAdapterFactories, "motion frame adapter", definition);
  }

  createSource(type: string, config: MotionRuntimeFactoryConfig): MotionSource {
    return requireFactory(this.sourceFactories, "motion source", type).create(config);
  }

  createFilter(type: string, config: MotionRuntimeFactoryConfig): MotionFrameFilter {
    return requireFactory(this.filterFactories, "motion filter", type).create(config);
  }

  createFrameAdapter(
    type: string,
    config: MotionRuntimeFactoryConfig,
  ): MotionFrameAdapter {
    return requireFactory(
      this.frameAdapterFactories,
      "motion frame adapter",
      type,
    ).create(config);
  }
}

export function createMotionRuntimeRegistry(): MotionRuntimeRegistryImpl {
  return new MotionRuntimeRegistryImpl();
}

export function registerMotionRuntimePlugins(
  plugins: readonly MotionRuntimePlugin[],
): MotionRuntimeRegistryImpl {
  const pluginIds = new Set<string>();
  const normalizedPluginIds = plugins.map((plugin) => plugin.id.trim());

  for (const id of normalizedPluginIds) {
    if (!id) throw new Error("Motion runtime plugin id must be non-empty");
    if (pluginIds.has(id)) {
      throw new Error(`Motion runtime plugin already registered: ${id}`);
    }
    pluginIds.add(id);
  }

  const registry = createMotionRuntimeRegistry();
  for (const plugin of plugins) plugin.register(registry);

  return registry;
}
