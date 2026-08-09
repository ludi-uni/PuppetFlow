# PuppetFlow Motion Runtime Phase 4 Design

**Date:** 2026-08-09

**Status:** Approved design; implementation pending

**Scope:** Canonical Motion Graph and Motion Runtime Plugin API

## Goal

Complete the advanced motion-runtime layer without replacing the existing
`MotionState` graph or extension system. Phase 4 adds an opt-in state machine
that selects canonical motion sources before mixing and a programmatic plugin
registry for source, filter, and frame-adapter factories.

Existing PFScript, `MotionState`, behavior plugins, extension plugins, adapters,
CLI configuration, and presets continue to work unchanged when the new APIs are
not used.

## Current Architecture

The repository already has two independent motion paths:

- The legacy path evaluates behavior, PFScript, extensions, and
  `MotionGraphDocument` into `MotionState` before updating legacy adapters.
- The canonical path receives `MotionFrame` values from `MotionSource`, applies
  fail-safe decisions, optionally processes them with `MotionFramePipeline`, and
  updates `MotionFrameAdapter` instances.

The existing `@puppetflow/motion-graph` package is a numeric `MotionState` graph.
Its node document, editor bridge, and executor are intentionally retained. A
canonical state machine is added alongside it rather than adding frame control
semantics to numeric graph nodes.

## Decisions

1. The canonical graph controls source policy and does not mutate a
   `MotionFrame`.
2. It runs after fail-safe/source-health calculation and before source filters
   and mixing.
3. The existing `MotionGraphDocument` and `executeMotionGraph()` contracts are
   unchanged.
4. Graph attachment is optional. With no graph attached, the Phase 1-3 canonical
   path remains behaviorally equivalent.
5. Runtime plugins use a separate `MotionRuntimePlugin` interface. Existing
   `ExtensionPlugin` remains unchanged because it produces `MotionState` values
   and does not own asynchronous lifecycle objects.
6. Phase 4 exposes programmatic APIs only. YAML/CLI factory configuration and a
   visual state-machine editor remain follow-up work.

## Canonical Data Flow

```text
Motion Sources
  -> Fail-safe and source health
  -> MotionFrameGraph source policy
  -> Source filters
  -> Motion Mixer
  -> Retarget
  -> Output filters
  -> MotionFrame adapters
```

The graph is placed before the mixer rather than after retargeting because its
initial use cases are `idle`, `tracking`, `scripted`, `gesture`, and `fallback`
source selection. A post-retarget graph could no longer change source ownership
without duplicating mixer responsibilities.

## MotionFrameGraph Document

The new document is exported from `@puppetflow/motion-graph` under distinct type
names.

```ts
export type MotionGraphSignalValue = string | number | boolean;

export interface MotionSourcePolicyOverride {
  enabled?: boolean;
  priority?: number;
  weight?: number;
}

export interface MotionFrameGraphStateDefinition {
  id: string;
  sources?: Readonly<Record<string, MotionSourcePolicyOverride>>;
}

export type MotionFrameGraphCondition =
  | {
      type: "signal";
      key: string;
      operator: "equals" | "notEquals" | "gt" | "gte" | "lt" | "lte";
      value: MotionGraphSignalValue;
    }
  | {
      type: "source";
      sourceId: string;
      field: "connected" | "stale";
      equals: boolean;
    }
  | {
      type: "elapsed";
      minimumMs: number;
    };

export interface MotionFrameGraphTransition {
  from: string;
  to: string;
  when: MotionFrameGraphCondition;
}

export interface MotionFrameGraphDocument {
  version: 1;
  initialState: string;
  states: readonly MotionFrameGraphStateDefinition[];
  transitions?: readonly MotionFrameGraphTransition[];
}
```

Validation rejects empty or duplicate state IDs, missing initial states,
transitions with unknown endpoints, non-finite priorities, weights outside
`0..1`, empty condition identifiers, invalid operators, and negative/non-finite
elapsed durations. Unknown source IDs are valid because a source may be attached
after the document is parsed.

## Controller and Transition Semantics

`createMotionFrameGraphController(document, options?)` validates and clones the
document. The controller owns the active state, state-entry timestamp, and
programmatic signals.

```ts
export interface MotionFrameGraphSourceStatus {
  connected: boolean;
  stale: boolean;
}

export interface MotionFrameGraphEvaluationContext {
  sources: Readonly<Record<string, MotionFrameGraphSourceStatus>>;
}

export interface MotionFrameGraphSnapshot {
  stateId: string;
  enteredAt: number;
  policy: Readonly<Record<string, MotionSourcePolicyOverride>>;
}
```

The controller provides `setSignal()`, `evaluate()`, `snapshot()`, and `reset()`.
Its clock defaults to monotonic `performance.now()` with a `Date.now()` fallback
and can be injected for deterministic tests.

Evaluation checks transitions whose `from` matches the current state in
document order. At most one transition is applied per evaluation. Undefined
signals, unknown sources, and missing source-health fields make their condition
false. Numeric comparison operators only match finite numeric signal values.
On transition, `enteredAt` becomes the current clock value and the destination
state's policy is returned. `reset()` clears all signals and restores the
initial state.

## Pipeline Policy Integration

`@puppetflow/motion-pipeline` adds optional dynamic policy arguments while
preserving every existing call signature:

```ts
export type MotionLayerPolicy = Readonly<Record<string, MotionSourcePolicyOverride>>;

interface MotionMixer {
  mix(
    inputs: readonly MotionFrameInput[],
    policy?: MotionLayerPolicy,
  ): MotionFrame | undefined;
  inspect?(
    inputs: readonly MotionFrameInput[],
    policy?: MotionLayerPolicy,
  ): MotionMixerInspection;
}

interface MotionFramePipeline {
  process(
    inputs: readonly MotionFrameInput[],
    deltaTime: number,
    policy?: MotionLayerPolicy,
  ): MotionFrame | undefined;
  inspect?(
    inputs: readonly MotionFrameInput[],
    policy?: MotionLayerPolicy,
  ): MotionMixerInspection | undefined;
}
```

`@puppetflow/motion-pipeline` adds a workspace dependency on
`@puppetflow/motion-graph` and reuses its exported
`MotionSourcePolicyOverride` type. The graph package does not depend on the
pipeline package, so this does not introduce a package cycle.

The policy is applied as an immutable overlay on the configured `MotionLayer`.
`enabled: false` excludes that source. `priority` and `weight` replace only the
corresponding configured values. Unspecified source fields retain the base layer
configuration. Custom mixer and pipeline implementations remain source
compatible because the new arguments are optional and may be ignored.

When no pipeline is attached, Runtime still applies `enabled: false` before raw
frame delivery. Priority and weight have no meaning on the raw multi-frame path
and are ignored there.

## Runtime Integration

`PuppetFlowRuntime` adds:

```ts
attachMotionFrameGraph(graph: MotionFrameGraphDocument): this;
setMotionGraphSignal(key: string, value: MotionGraphSignalValue): this;
getMotionFrameGraphState(): MotionFrameGraphSnapshot | undefined;
```

During canonical dispatch Runtime builds source status from its existing
fail-safe and inspector health records, evaluates the graph, filters disabled
inputs, and passes the active policy to pipeline inspection and processing.
The same policy is used for inspection and output so reported owners match the
delivered frame.

Graph validation happens during attachment. Runtime stop resets graph state and
signals along with pipeline/filter state. Graph evaluation uses only pure
document/controller logic; unexpected evaluation failures are logged and the
current tick falls back to the unmodified input list so graph failure cannot
silence motion output.

## Motion Runtime Plugin API

`@puppetflow/extension-core` adds a separate programmatic registry. Factory
configuration is `Readonly<Record<string, unknown>>` so plugins own validation
without forcing a repository-wide config schema.

```ts
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
```

Its package manifest adds the existing workspace packages
`@puppetflow/adapter-core`, `@puppetflow/motion-pipeline`, and
`@puppetflow/source-core`; no external dependency is introduced.

The registry supports `addSourceFactory()`, `addFilterFactory()`,
`addFrameAdapterFactory()`, and matching `createSource()`, `createFilter()`, and
`createFrameAdapter()` methods. Registration rejects empty IDs and duplicate
type IDs within the same capability. The same type ID may exist once in each
capability so a plugin can provide both `vmc` input and `vmc` output.

Factory creation is synchronous and does not start or initialize returned
objects. Callers connect instances through existing `attachMotionSource()`,
`createMotionFramePipeline()`, and `attachMotionAdapter()` APIs. Factory errors
propagate to the caller before Runtime start. Runtime continues to own lifecycle
error isolation after attachment.

`registerMotionRuntimePlugins(plugins)` creates a registry and applies plugins
in array order. This mirrors the existing extension registry without changing
`ExtensionPlugin`.

## Compatibility and Migration

- No existing interface member is removed or made mandatory.
- `MotionGraphDocument`, editor serialization, PFScript, and behavior execution
  are unchanged.
- Existing custom `MotionMixer` and `MotionFramePipeline` implementations may
  ignore the new optional policy argument.
- Existing Runtime code requires no migration. New behavior is opt-in through
  `attachMotionFrameGraph()` or explicit runtime-plugin registry use.
- No package version floor or external dependency is added.

## Error Handling

- Invalid graph documents fail during parse/attachment, before Runtime starts.
- Duplicate plugin registrations fail during registry construction.
- Factory validation/creation errors propagate synchronously to configuration
  code.
- Source, filter, pipeline, and adapter runtime failures continue through the
  existing lifecycle and dispatch isolation paths.
- Unknown signals and source-health references evaluate false rather than
  throwing during a real-time tick.
- Only one graph transition can occur per tick, preventing transition cycles
  from becoming unbounded work.

## Testing

Focused tests cover:

1. Graph parsing, cloning, validation, duplicate states, initial-state and
   transition endpoint errors.
2. Signal equality/numeric comparisons, connected/stale source conditions,
   elapsed-state conditions, undefined values, and injected clock behavior.
3. Document-order deterministic transitions, one-transition-per-evaluation,
   state entry time, snapshots, and reset clearing signals.
4. Mixer and pipeline source disabling plus priority/weight overlays without
   mutating base layers or input frames.
5. Runtime default behavior with no graph, graph-controlled raw delivery,
   pipeline ownership/output agreement, evaluation fallback, and stop reset.
6. Source/filter/frame-adapter factory registration, creation, duplicate
   rejection, error propagation, and a real Runtime integration using factory
   products.
7. Existing motion-graph, motion-pipeline, extension-core, and Runtime tests,
   followed by repository build, full Vitest, lint, format, preset generation,
   and lockfile-frozen install checks.

## Documentation and Example

Phase 4 adds:

- `docs/reference/motion-frame-graph.md` for document/API/transition semantics;
- `docs/reference/motion-runtime-plugins.md` for factory registration and
  lifecycle ownership;
- an architecture update showing the legacy and canonical graphs separately;
- a no-hardware example that switches between synthetic `tracking` and `idle`
  sources through a signal and demonstrates a plugin-provided filter/output.

## Deferred Work

- YAML/CLI schema and automatic runtime-plugin factory instantiation;
- visual MotionFrameGraph editing in Studio;
- multiple-condition expressions and nested state machines;
- Inspector HTTP/WebSocket/Observatory transport;
- One Euro filtering and automatic calibration;
- frame-native WebSocket/MQTT output adapters;
- VMC validation and interoperability testing, which remain VMC Lab work.
