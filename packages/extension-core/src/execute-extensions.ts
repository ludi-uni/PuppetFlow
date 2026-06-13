import type { BehaviorStatement } from "@puppetflow/behavior";
import {
  clamp01,
  mergeMotionState,
  MOTION_STATE_KEYS,
  type MotionState,
  type MotionStateKey,
} from "@puppetflow/core";
import type { MotionGraphDocument } from "@puppetflow/motion-graph";
import {
  createDefaultCustomValues,
  normalizePackConfig,
  type MotionRegistryImpl,
} from "./registry.js";
import type {
  ExtensionContext,
  ExtensionInvocation,
  ExtensionOutput,
  ExtensionSources,
  PresetExtensions,
  ResolvedExtensions,
} from "./types.js";

function collectBehaviorPackInvocations(
  statements: BehaviorStatement[],
  invocations: ExtensionInvocation[],
): void {
  for (const statement of statements) {
    if (statement.type === "MotionPack") {
      invocations.push({
        kind: "pack",
        id: statement.packId,
        config: statement.config ?? {},
      });
      continue;
    }

    if (statement.type === "Block") {
      collectBehaviorPackInvocations(statement.statements, invocations);
      continue;
    }

    if (statement.type === "If") {
      collectBehaviorPackInvocations(statement.then, invocations);
      if (statement.else) {
        collectBehaviorPackInvocations(statement.else, invocations);
      }
    }
  }
}

function collectGraphInvocations(
  graph: MotionGraphDocument,
  invocations: ExtensionInvocation[],
): void {
  for (const node of graph.nodes) {
    if (node.type === "motionPack") {
      invocations.push({
        kind: "pack",
        id: String(node.data.packId ?? ""),
        config: parseNumericConfig(node.data),
      });
      continue;
    }

    if (node.type === "motionGenerator") {
      invocations.push({
        kind: "generator",
        id: String(node.data.generatorId ?? ""),
        config: parseNumericConfig(node.data),
      });
    }
  }
}

function parseNumericConfig(data: Record<string, unknown>): Record<string, number> {
  const config: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === "packId" || key === "generatorId" || key === "label") {
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      config[key] = value;
    }
  }
  return config;
}

function collectPresetInvocations(
  extensions: PresetExtensions | undefined,
  invocations: ExtensionInvocation[],
): void {
  if (!extensions) {
    return;
  }

  for (const pack of extensions.packs ?? []) {
    invocations.push({
      kind: "pack",
      id: pack.id,
      config: pack.config ?? {},
    });
  }

  for (const fn of extensions.functions ?? []) {
    invocations.push({
      kind: "generator",
      id: fn.name,
      config: fn.args ?? {},
    });
  }
}

export function collectExtensionInvocations(
  sources: ExtensionSources,
): ExtensionInvocation[] {
  const invocations: ExtensionInvocation[] = [];

  collectPresetInvocations(sources.presetExtensions, invocations);

  if (sources.behaviorPackInvocations !== undefined) {
    invocations.push(...sources.behaviorPackInvocations);
  } else if (sources.behavior) {
    collectBehaviorPackInvocations(sources.behavior.statements, invocations);
  }

  if (sources.graph) {
    collectGraphInvocations(sources.graph, invocations);
  }

  return invocations;
}

function mergeCustomPartials(
  base: Record<string, number>,
  partials: Array<Record<string, number>>,
): Record<string, number> {
  const keys = new Set<string>(Object.keys(base));
  for (const partial of partials) {
    for (const key of Object.keys(partial)) {
      keys.add(key);
    }
  }

  const result: Record<string, number> = { ...base };

  for (const key of keys) {
    const values: number[] = [];
    for (const partial of partials) {
      const value = partial[key];
      if (value !== undefined) {
        values.push(value);
      }
    }
    if (values.length === 0) {
      continue;
    }
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    result[key] = clamp01(average);
  }

  return result;
}

function applyExtensionOutput(
  standardPartials: Partial<MotionState>[],
  customPartials: Array<Record<string, number>>,
  output: ExtensionOutput,
): void {
  if (output.standard && Object.keys(output.standard).length > 0) {
    standardPartials.push(output.standard);
  }
  if (output.custom && Object.keys(output.custom).length > 0) {
    customPartials.push(output.custom);
  }
}

export function executeExtensions(
  registry: MotionRegistryImpl,
  ctx: Omit<ExtensionContext, "custom">,
  sources: ExtensionSources,
): ResolvedExtensions {
  const custom = createDefaultCustomValues(
    registry,
    sources.presetExtensions?.parameterDefaults ?? {},
  );
  const invocations = collectExtensionInvocations(sources);
  const standardPartials: Partial<MotionState>[] = [];
  const customPartials: Array<Record<string, number>> = [];
  const extensionCtx: ExtensionContext = { ...ctx, custom };

  for (const invocation of invocations) {
    if (invocation.kind === "pack") {
      const pack = registry.packs.get(invocation.id);
      if (!pack) {
        continue;
      }
      const config = normalizePackConfig(pack, invocation.config);
      applyExtensionOutput(
        standardPartials,
        customPartials,
        pack.execute(extensionCtx, config),
      );
      continue;
    }

    const generator = registry.generators.get(invocation.id);
    if (generator) {
      const config = normalizePackConfig(
        {
          id: generator.id,
          label: generator.label,
          configFields: generator.configFields,
          execute: generator.execute,
        },
        invocation.config,
      );
      applyExtensionOutput(
        standardPartials,
        customPartials,
        generator.execute(extensionCtx, config),
      );
      continue;
    }

    const fn = registry.functions.get(invocation.id);
    if (fn) {
      const value = fn.execute(extensionCtx, invocation.config);
      if (MOTION_STATE_KEYS.includes(invocation.id as MotionStateKey)) {
        standardPartials.push({
          [invocation.id]: clamp01(value),
        } as Partial<MotionState>);
      }
    }
  }

  for (const node of sources.graph?.nodes ?? []) {
    const nodeDef = registry.nodes.get(node.type);
    if (!nodeDef) {
      continue;
    }
    applyExtensionOutput(
      standardPartials,
      customPartials,
      nodeDef.execute(extensionCtx, node.data, parseNumericConfig(node.data)),
    );
  }

  const mergedCustom = mergeCustomPartials(custom, customPartials);
  const standard = mergeMotionState(ctx.motion, standardPartials);

  return {
    standard: { ...standard, custom: mergedCustom },
    custom: mergedCustom,
    invocations,
  };
}

export function executePfScriptFunction(
  registry: MotionRegistryImpl,
  ctx: ExtensionContext,
  name: string,
  args: Record<string, number>,
): number {
  const fn = registry.functions.get(name);
  if (!fn) {
    return 0;
  }
  return fn.execute(ctx, args);
}
