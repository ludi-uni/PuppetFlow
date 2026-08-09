# PuppetFlow MotionFrame Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in canonical state machine that selects MotionFrame sources and dynamically overrides mixer priority and weight without changing the existing MotionState graph.

**Architecture:** Add a separate validated MotionFrameGraph document and pure controller to `@puppetflow/motion-graph`. Feed its immutable source policy into optional mixer/pipeline arguments, then evaluate it in Runtime after fail-safe health calculation and before canonical mixing or raw delivery.

**Tech Stack:** TypeScript 5.9, `@puppetflow/core` MotionFrame, `@puppetflow/motion-graph`, `@puppetflow/motion-pipeline`, `@puppetflow/runtime`, Vitest 3, tsup, pnpm workspaces.

## Global Constraints

- Preserve `MotionGraphDocument`, `executeMotionGraph()`, PFScript, MotionState, ExtensionPlugin, CLI, presets, and existing adapters.
- Graph attachment is opt-in; no attached graph must preserve Phase 1-3 behavior.
- Apply graph policy after fail-safe health calculation and before source filters/mixing.
- Apply at most one transition per evaluation in document order.
- Use an injectable monotonic clock and reset state plus signals on Runtime stop.
- Unknown source IDs are valid; undefined signal and source conditions evaluate false.
- Add no external dependency and no YAML, CLI, Studio editor, or transport wiring.
- Follow RED-GREEN-REFACTOR for every production behavior.
- Preserve unrelated files in the main checkout and work only on `codex/motion-runtime-phase4`.

---

### Task 1: Add the canonical graph document and validation

**Files:**

- Create: `packages/motion-graph/src/frame-graph-types.ts`
- Create: `packages/motion-graph/src/frame-graph-types.test.ts`
- Modify: `packages/motion-graph/src/index.ts`

**Interfaces:**

- Consumes: no Phase 4 interface.
- Produces: `MotionGraphSignalValue`, `MotionSourcePolicyOverride`, `MotionFrameGraphStateDefinition`, `MotionFrameGraphCondition`, `MotionFrameGraphTransition`, `MotionFrameGraphDocument`, and `parseMotionFrameGraph(value)`.

- [ ] **Step 1: Write failing parser and validation tests**

Create `frame-graph-types.test.ts` with explicit valid cloning and invalid document cases:

```ts
import { describe, expect, it } from "vitest";
import { parseMotionFrameGraph } from "./frame-graph-types.js";

const valid = {
  version: 1,
  initialState: "idle",
  states: [
    { id: "idle", sources: { idle: { enabled: true, priority: 10 } } },
    {
      id: "tracking",
      sources: {
        idle: { enabled: false },
        tracker: { enabled: true, priority: 100, weight: 0.8 },
      },
    },
  ],
  transitions: [
    {
      from: "idle",
      to: "tracking",
      when: { type: "signal", key: "tracking", operator: "equals", value: true },
    },
  ],
} as const;

describe("parseMotionFrameGraph", () => {
  it("validates and clones a version 1 document", () => {
    const parsed = parseMotionFrameGraph(valid);
    expect(parsed).toEqual(valid);
    expect(parsed).not.toBe(valid);
    expect(parsed.states[0]).not.toBe(valid.states[0]);
  });

  it.each([
    [{ ...valid, initialState: "missing" }, "initialState"],
    [{ ...valid, states: [{ id: "idle" }, { id: "idle" }] }, "duplicate"],
    [
      {
        ...valid,
        transitions: [{ from: "idle", to: "missing", when: valid.transitions[0].when }],
      },
      "transition",
    ],
    [
      { ...valid, states: [{ id: "idle", sources: { idle: { weight: 2 } } }] },
      "weight",
    ],
    [
      {
        ...valid,
        transitions: [
          { from: "idle", to: "tracking", when: { type: "elapsed", minimumMs: -1 } },
        ],
      },
      "minimumMs",
    ],
  ])("rejects invalid graph %#", (document, message) => {
    expect(() => parseMotionFrameGraph(document)).toThrow(message);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm exec vitest run packages/motion-graph/src/frame-graph-types.test.ts
```

Expected: FAIL because `./frame-graph-types.js` does not exist.

- [ ] **Step 3: Implement the document types and complete validation**

Create the exact discriminated unions from the approved design. Implement `parseMotionFrameGraph` as a clone-and-validate boundary with these concrete checks:

```ts
export function parseMotionFrameGraph(value: unknown): MotionFrameGraphDocument {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error("MotionFrameGraph.version must be 1");
  }
  if (typeof value.initialState !== "string" || !value.initialState.trim()) {
    throw new Error("MotionFrameGraph.initialState must be a non-empty string");
  }
  if (!Array.isArray(value.states) || value.states.length === 0) {
    throw new Error("MotionFrameGraph.states must be a non-empty array");
  }

  const states = value.states.map(parseState);
  const stateIds = new Set<string>();
  for (const state of states) {
    if (stateIds.has(state.id)) {
      throw new Error(`MotionFrameGraph contains duplicate state: ${state.id}`);
    }
    stateIds.add(state.id);
  }
  if (!stateIds.has(value.initialState)) {
    throw new Error(`MotionFrameGraph.initialState is unknown: ${value.initialState}`);
  }

  const transitions = (value.transitions ?? []).map(parseTransition);
  for (const transition of transitions) {
    if (!stateIds.has(transition.from) || !stateIds.has(transition.to)) {
      throw new Error(`MotionFrameGraph transition references an unknown state`);
    }
  }
  return { version: 1, initialState: value.initialState, states, transitions };
}
```

`parseState`, `parseTransition`, and `parseCondition` must clone nested policy records and enforce every validation rule in the design: non-empty IDs, finite priority, `0..1` weight, supported signal operators, primitive signal values, non-empty condition keys/source IDs, and finite non-negative elapsed milliseconds.

Export all new types and `parseMotionFrameGraph` from `src/index.ts`; do not alter legacy exports.

- [ ] **Step 4: Run focused and legacy motion-graph tests**

Run:

```powershell
pnpm exec vitest run packages/motion-graph/src/frame-graph-types.test.ts packages/motion-graph/src/types.test.ts packages/motion-graph/src/execute.test.ts packages/motion-graph/src/graph-editor-bridge.test.ts
pnpm --filter @puppetflow/motion-graph build
```

Expected: all tests and the package build pass.

- [ ] **Step 5: Commit the graph document boundary**

```powershell
git add packages/motion-graph/src/frame-graph-types.ts packages/motion-graph/src/frame-graph-types.test.ts packages/motion-graph/src/index.ts
git commit -m "feat: define canonical motion frame graph"
```

### Task 2: Implement deterministic graph evaluation

**Files:**

- Create: `packages/motion-graph/src/frame-graph-controller.ts`
- Create: `packages/motion-graph/src/frame-graph-controller.test.ts`
- Modify: `packages/motion-graph/src/index.ts`

**Interfaces:**

- Consumes: `MotionFrameGraphDocument`, `MotionGraphSignalValue`, `MotionSourcePolicyOverride`, and `parseMotionFrameGraph` from Task 1.
- Produces: `MotionFrameGraphSourceStatus`, `MotionFrameGraphEvaluationContext`, `MotionFrameGraphSnapshot`, `MotionFrameGraphController`, and `createMotionFrameGraphController(document, options?)`.

- [ ] **Step 1: Write failing transition, clock, and reset tests**

Use an injected clock and a document with signal, source, and elapsed transitions:

```ts
let time = 100;
const controller = createMotionFrameGraphController(document, { now: () => time });

expect(controller.snapshot()).toEqual({
  stateId: "idle",
  enteredAt: 100,
  policy: { idle: { enabled: true, priority: 10 } },
});

controller.setSignal("tracking", true);
expect(controller.evaluate({ sources: {} }).stateId).toBe("tracking");

time = 250;
expect(
  controller.evaluate({
    sources: { tracker: { connected: false, stale: true } },
  }).stateId,
).toBe("fallback");

controller.reset();
expect(controller.snapshot().stateId).toBe("idle");
expect(controller.evaluate({ sources: {} }).stateId).toBe("idle");
```

Add separate assertions that undefined signals and unknown source IDs stay false, numeric operators reject non-numeric values, elapsed uses state-entry time, only the first matching transition runs, snapshots are defensive clones, and one evaluation never chains through a second state.

- [ ] **Step 2: Run the controller test and verify RED**

```powershell
pnpm exec vitest run packages/motion-graph/src/frame-graph-controller.test.ts
```

Expected: FAIL because `createMotionFrameGraphController` is not exported.

- [ ] **Step 3: Implement the pure controller**

Use this state model and evaluation algorithm:

```ts
export interface MotionFrameGraphController {
  setSignal(key: string, value: MotionGraphSignalValue): void;
  evaluate(context: MotionFrameGraphEvaluationContext): MotionFrameGraphSnapshot;
  snapshot(): MotionFrameGraphSnapshot;
  reset(): void;
}

export function createMotionFrameGraphController(
  input: MotionFrameGraphDocument,
  options: { now?: () => number } = {},
): MotionFrameGraphController {
  const document = parseMotionFrameGraph(input);
  const now = options.now ?? monotonicNow;
  const states = new Map(document.states.map((state) => [state.id, state]));
  const signals = new Map<string, MotionGraphSignalValue>();
  let stateId = document.initialState;
  let enteredAt = now();

  return {
    setSignal(key, value) {
      if (!key.trim()) throw new Error("Motion graph signal key must be non-empty");
      signals.set(key, value);
    },
    evaluate(context) {
      const currentTime = now();
      const transition = document.transitions?.find(
        (candidate) =>
          candidate.from === stateId &&
          matchesCondition(candidate.when, context, signals, currentTime - enteredAt),
      );
      if (transition) {
        stateId = transition.to;
        enteredAt = currentTime;
      }
      return cloneSnapshot(states.get(stateId)!, stateId, enteredAt);
    },
    snapshot() {
      return cloneSnapshot(states.get(stateId)!, stateId, enteredAt);
    },
    reset() {
      signals.clear();
      stateId = document.initialState;
      enteredAt = now();
    },
  };
}
```

Implement `matchesCondition` exhaustively. `equals`/`notEquals` use strict equality. `gt`/`gte`/`lt`/`lte` require finite numbers on both sides. Source conditions require a present source record. Elapsed matches when `elapsedMs >= minimumMs`. `monotonicNow` uses `performance.now()` when available and `Date.now()` otherwise.

- [ ] **Step 4: Run graph tests and build**

```powershell
pnpm exec vitest run packages/motion-graph/src/frame-graph-controller.test.ts packages/motion-graph/src/frame-graph-types.test.ts
pnpm --filter @puppetflow/motion-graph build
```

Expected: all pass.

- [ ] **Step 5: Commit the controller**

```powershell
git add packages/motion-graph/src/frame-graph-controller.ts packages/motion-graph/src/frame-graph-controller.test.ts packages/motion-graph/src/index.ts
git commit -m "feat: evaluate canonical motion frame graph"
```

### Task 3: Apply dynamic source policy in mixer and pipeline

**Files:**

- Modify: `packages/motion-pipeline/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/motion-pipeline/src/types.ts`
- Modify: `packages/motion-pipeline/src/mixer.ts`
- Modify: `packages/motion-pipeline/src/pipeline.ts`
- Modify: `packages/motion-pipeline/src/mixer.test.ts`
- Modify: `packages/motion-pipeline/src/pipeline.test.ts`

**Interfaces:**

- Consumes: `MotionSourcePolicyOverride` from `@puppetflow/motion-graph`.
- Produces: `MotionLayerPolicy`; optional `policy` parameters on `MotionMixer.mix`, `MotionMixer.inspect`, `MotionFramePipeline.process`, and `MotionFramePipeline.inspect`.

- [ ] **Step 1: Write failing mixer policy tests**

Add tests that prove disabled sources are absent from output metadata/inspection, priority overrides change the owner, weight overrides change same-priority blending, and the configured base layer is not mutated:

```ts
const layers = [
  { source: "idle", priority: 10, weight: 1 },
  { source: "tracking", priority: 100, weight: 1 },
] as const;
const mixer = createMotionMixer(layers);
const inputs = [
  { sourceId: "idle", frame: { timestamp: 1, parameters: { x: 0 } } },
  { sourceId: "tracking", frame: { timestamp: 2, parameters: { x: 1 } } },
];

expect(
  mixer.mix(inputs, {
    tracking: { enabled: false },
    idle: { priority: 200, weight: 0.5 },
  }),
).toMatchObject({ parameters: { x: 0 }, metadata: { sourceIds: ["idle"] } });
expect(layers[0]).toEqual({ source: "idle", priority: 10, weight: 1 });
```

Add a same-priority `0.25/0.75` test expecting the weighted numeric value `0.75`, and inspection assertions showing the overlaid priority/weight.

- [ ] **Step 2: Run mixer tests and verify RED**

```powershell
pnpm exec vitest run packages/motion-pipeline/src/mixer.test.ts -t policy
```

Expected: FAIL because `mix` and `inspect` do not accept/apply policy.

- [ ] **Step 3: Implement immutable mixer overlays**

Add:

```ts
export type MotionLayerPolicy = Readonly<Record<string, MotionSourcePolicyOverride>>;
```

Extend the optional signatures. Before mixing or inspection, exclude inputs whose
override is `enabled: false`. Resolve each layer with:

```ts
function resolveLayer(
  sourceId: string,
  layerMap: ReadonlyMap<string, MotionLayer>,
  policy: MotionLayerPolicy | undefined,
): MotionLayer {
  const base = layerMap.get(sourceId) ?? { ...DEFAULT_LAYER, source: sourceId };
  const override = policy?.[sourceId];
  return {
    ...base,
    ...(override?.priority !== undefined ? { priority: override.priority } : {}),
    ...(override?.weight !== undefined ? { weight: override.weight } : {}),
  };
}
```

Validate dynamic priority/weight with the same finite and `0..1` rules as static layers. Do not mutate `layerMap`, input frames, or policy objects.

- [ ] **Step 4: Add failing pipeline forwarding tests, then implement forwarding**

In `pipeline.test.ts`, create a mixer with `mix` and `inspect` spies, call:

```ts
const policy = { tracker: { enabled: false, priority: 200 } } as const;
pipeline.process(inputs, 1 / 60, policy);
pipeline.inspect?.(inputs, policy);
expect(mix).toHaveBeenCalledWith(expect.any(Array), policy);
expect(inspect).toHaveBeenCalledWith(expect.any(Array), policy);
```

Run the test and verify it fails because policy is not forwarded. Then extend
`MotionFramePipeline` and pass the optional third/second arguments to the mixer.

- [ ] **Step 5: Update dependency metadata and run package verification**

Add `@puppetflow/motion-graph: workspace:*` to motion-pipeline dependencies, then run:

```powershell
pnpm install --lockfile-only
pnpm exec vitest run packages/motion-pipeline/src/mixer.test.ts packages/motion-pipeline/src/pipeline.test.ts
pnpm --filter @puppetflow/motion-pipeline build
```

Expected: lockfile importer matches the manifest; tests and build pass.

- [ ] **Step 6: Commit policy support**

```powershell
git add packages/motion-pipeline pnpm-lock.yaml
git commit -m "feat: apply motion graph source policy"
```

### Task 4: Integrate MotionFrameGraph into Runtime

**Files:**

- Modify: `packages/runtime/src/runtime.ts`
- Modify: `packages/runtime/src/runtime.test.ts`
- Modify: `packages/runtime/src/index.ts`

**Interfaces:**

- Consumes: `createMotionFrameGraphController`, graph document/signal/snapshot types, `MotionLayerPolicy`, and existing source-health records.
- Produces: `attachMotionFrameGraph`, `setMotionGraphSignal`, and `getMotionFrameGraphState` on `PuppetFlowRuntime`.

- [ ] **Step 1: Write failing Runtime graph tests**

Add tests with synthetic `idle` and `tracker` sources:

```ts
const process = vi.fn((inputs) => inputs[0]?.frame);
const runtime = new PuppetFlowRuntime()
  .attachMotionSource(source("idle", 0))
  .attachMotionSource(source("tracker", 1))
  .attachMotionPipeline({ process, inspect: vi.fn(), reset: vi.fn() })
  .attachMotionFrameGraph({
    version: 1,
    initialState: "idle",
    states: [
      { id: "idle", sources: { idle: { enabled: true }, tracker: { enabled: false } } },
      {
        id: "tracking",
        sources: {
          idle: { enabled: false },
          tracker: { enabled: true, priority: 200 },
        },
      },
    ],
    transitions: [
      {
        from: "idle",
        to: "tracking",
        when: { type: "signal", key: "tracking", operator: "equals", value: true },
      },
    ],
  })
  .setMotionGraphSignal("tracking", true);

await runtime.start();
expect(process).toHaveBeenCalledWith(
  expect.any(Array),
  expect.any(Number),
  expect.objectContaining({ tracker: { enabled: true, priority: 200 } }),
);
expect(runtime.getMotionFrameGraphState()?.stateId).toBe("tracking");
await runtime.stop();
expect(runtime.getMotionFrameGraphState()?.stateId).toBe("idle");
```

Add distinct tests for no-graph two-argument pipeline compatibility, raw delivery excluding disabled sources, source connected/stale condition input, the same policy passed to `inspect` and `process`, invalid graph rejection at attachment, and a defensive fallback by replacing the private controller's `evaluate` with a throwing spy through a narrow test-only cast.

- [ ] **Step 2: Run Runtime tests and verify RED**

```powershell
pnpm exec vitest run packages/runtime/src/runtime.test.ts -t "motion frame graph"
```

Expected: FAIL because `attachMotionFrameGraph` is missing.

- [ ] **Step 3: Implement Runtime state and public methods**

Add private controller/snapshot fields and these additive methods:

```ts
attachMotionFrameGraph(graph: MotionFrameGraphDocument): this {
  this.motionFrameGraph = createMotionFrameGraphController(graph);
  this.motionFrameGraphSnapshot = this.motionFrameGraph.snapshot();
  return this;
}

setMotionGraphSignal(key: string, value: MotionGraphSignalValue): this {
  if (!this.motionFrameGraph) {
    throw new Error("No MotionFrameGraph is attached");
  }
  this.motionFrameGraph.setSignal(key, value);
  return this;
}

getMotionFrameGraphState(): MotionFrameGraphSnapshot | undefined {
  return this.motionFrameGraphSnapshot
    ? cloneMotionFrameGraphSnapshot(this.motionFrameGraphSnapshot)
    : undefined;
}
```

Keep the attached graph across stop/start, but call controller `reset()` on stop and refresh the snapshot. `setMotionGraphSignal` must reject use before attachment rather than silently dropping a signal.

- [ ] **Step 4: Evaluate and apply policy during canonical dispatch**

After fail-safe has updated each `MotionSourceHealth.stale`, build:

```ts
const sources = Object.fromEntries(
  this.motionSources.map((source) => {
    const health = this.motionSourceHealth.get(source.id);
    return [
      source.id,
      { connected: health?.connected ?? false, stale: health?.stale ?? false },
    ];
  }),
);
```

Evaluate once per tick inside `try/catch`. On success, save the snapshot and use
`snapshot.policy`. On failure, log the error and use `undefined`. Pass exactly the
same policy to `motionPipeline.inspect(inputs, policy)` and
`motionPipeline.process(inputs, deltaTime, policy)`. For the raw path, remove
inputs whose policy entry has `enabled: false` before calling adapters.

- [ ] **Step 5: Run focused, package, and build checks**

```powershell
pnpm exec vitest run packages/runtime/src/runtime.test.ts packages/motion-graph/src/frame-graph-controller.test.ts packages/motion-pipeline/src/mixer.test.ts packages/motion-pipeline/src/pipeline.test.ts
pnpm --filter @puppetflow/motion-graph build
pnpm --filter @puppetflow/motion-pipeline build
pnpm --filter @puppetflow/runtime build
```

Expected: all pass.

- [ ] **Step 6: Commit Runtime integration**

```powershell
git add packages/runtime/src/runtime.ts packages/runtime/src/runtime.test.ts packages/runtime/src/index.ts
git commit -m "feat: integrate canonical motion frame graph"
```

### Task 5: Document and demonstrate the canonical graph

**Files:**

- Create: `docs/reference/motion-frame-graph.md`
- Create: `examples/motion-frame-graph/package.json`
- Create: `examples/motion-frame-graph/graph.ts`
- Create: `examples/motion-frame-graph/README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/superpowers/specs/2026-08-08-motion-runtime-phase1-design.md`
- Modify: `docs/superpowers/specs/2026-08-08-motion-runtime-phase3-design.md`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: the completed MotionFrameGraph, pipeline, and Runtime APIs.
- Produces: public reference documentation and a no-hardware executable example.

- [ ] **Step 1: Write the reference and architecture mapping**

Document the exact version 1 schema, all conditions, first-match/one-transition semantics, unknown-value behavior, source-policy overlay rules, Runtime methods, stop reset, raw-path behavior, and a migration statement that existing graphs require no changes. Update architecture with separate legacy and canonical flows.

Change stale design statuses to `Implemented and verified` for Phase 1 and Phase 3; do not rewrite their historical scope or evidence.

- [ ] **Step 2: Add the no-hardware example**

Create `@puppetflow/example-motion-frame-graph` with `tsx graph.ts`. The script must:

```ts
const graph = createMotionFrameGraphController(document, { now: () => clock });
const pipeline = createMotionFramePipeline({
  layers: [
    { source: "idle", priority: 10 },
    { source: "tracker", priority: 100 },
  ],
});

const idle = graph.evaluate({ sources: {} });
console.log("idle", pipeline.process(inputs, 1 / 60, idle.policy));
graph.setSignal("tracking", true);
const tracking = graph.evaluate({
  sources: { tracker: { connected: true, stale: false } },
});
console.log("tracking", pipeline.process(inputs, 1 / 60, tracking.policy));
```

Use fixed synthetic frames and injected time only; do not open sockets or require VMC hardware.

- [ ] **Step 3: Link dependencies and run example/docs checks**

```powershell
pnpm install --lockfile-only
pnpm --filter @puppetflow/example-motion-frame-graph start
pnpm exec prettier --check docs/reference/motion-frame-graph.md docs/architecture.md examples/motion-frame-graph docs/superpowers/specs/2026-08-08-motion-runtime-phase1-design.md docs/superpowers/specs/2026-08-08-motion-runtime-phase3-design.md
git diff --check
```

Expected: the example prints distinct idle/tracking outputs; format and diff checks pass.

- [ ] **Step 4: Run Graph-plan verification**

```powershell
pnpm exec vitest run packages/motion-graph packages/motion-pipeline packages/runtime/src/runtime.test.ts
pnpm --filter @puppetflow/motion-graph build
pnpm --filter @puppetflow/motion-pipeline build
pnpm --filter @puppetflow/runtime build
pnpm exec eslint packages/motion-graph/src packages/motion-pipeline/src packages/runtime/src examples/motion-frame-graph
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit Graph docs and example**

```powershell
git add docs/architecture.md docs/reference/motion-frame-graph.md docs/superpowers/specs/2026-08-08-motion-runtime-phase1-design.md docs/superpowers/specs/2026-08-08-motion-runtime-phase3-design.md examples/motion-frame-graph pnpm-lock.yaml
git commit -m "docs: document canonical motion frame graph"
```
