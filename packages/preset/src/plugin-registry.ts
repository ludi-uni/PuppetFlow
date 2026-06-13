import type { BehaviorPlugin } from "@puppetflow/core";

export type BehaviorPluginFactory = (
  config?: Record<string, unknown>,
) => BehaviorPlugin;

const registry = new Map<string, BehaviorPluginFactory>();

export function registerBehaviorPlugin(
  id: string,
  factory: BehaviorPluginFactory,
): void {
  registry.set(id, factory);
}

export function getBehaviorPluginFactory(
  id: string,
): BehaviorPluginFactory | undefined {
  return registry.get(id);
}

export function listRegisteredBehaviorPluginIds(): string[] {
  return [...registry.keys()];
}
