# PuppetFlow Motion Runtime Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add opt-in source fail-safe behavior and a structured Runtime Inspector for source health, mixer ownership, and output telemetry while preserving existing motion and legacy paths.

**Architecture:** Keep fail-safe state, source receipt health, and adapter telemetry in @puppetflow/runtime. Keep neutral-frame math and mixer inspection pure and transport-independent. Extend Phase 2 interfaces only with optional methods so custom mixers and pipelines remain compatible.

**Tech Stack:** TypeScript, @puppetflow/core MotionFrame, @puppetflow/motion-pipeline, Vitest, tsup, and the existing Runtime lifecycle.

## Global Constraints

- Preserve existing MotionSource, MotionFrameAdapter, Adapter, MotionState, PFScript, CLI, YAML, and VMC behavior when Phase 3 is not configured.
- Measure stale timeout from local frame receipt time, not source-provided timestamps.
- Keep connected and stale as separate source health values.
- Preserve partial transforms and unknown bones; never synthesize absent components during neutral blending.
- Use numeric zero, position zero, quaternion identity, and scale one as neutral targets.
- Keep fail-safe, pipeline, source, and adapter failures isolated.
- Do not add YAML, CLI, HTTP, WebSocket, GUI, or Observatory transport wiring.
- Preserve unrelated dirty-worktree files and do not edit the conflicted docs/architecture.md.
- Run the closest test before broader package, build, lint, and full-suite verification.

---

### Task 1: Add optional MotionMixer inspection

**Files:**

- Modify: packages/motion-pipeline/src/types.ts
- Modify: packages/motion-pipeline/src/mixer.ts
- Modify: packages/motion-pipeline/src/index.ts
- Modify: packages/motion-pipeline/src/mixer.test.ts

**Interfaces:**

Produce these additive contracts:

```ts
export interface MotionChannelOwner {
  sourceId: string;
  priority: number;
  weight: number;
}

export interface MotionMixerInspection {
  bones: Record<string, MotionChannelOwner[]>;
  blendShapes: Record<string, MotionChannelOwner[]>;
  parameters: Record<string, MotionChannelOwner[]>;
}

export interface MotionMixer {
  mix(inputs: readonly MotionFrameInput[]): MotionFrame | undefined;
  inspect?(inputs: readonly MotionFrameInput[]): MotionMixerInspection;
}
```

- [ ] Step 1: Write failing inspection tests. Assert highest-priority filtering, bone/BlendShape/parameter masks, same-priority contributors, missing source frames, and partial bone transforms.
- [ ] Step 2: Run RED with the command vitest run packages/motion-pipeline/src/mixer.test.ts -t inspection. It must fail because inspect is not implemented.
- [ ] Step 3: Refactor the mixer’s existing candidate selection so mix and inspect share source, priority, mask, and weight rules. Inspect returns every eligible highest-priority contributor in deterministic order without mutating frames.
- [ ] Step 4: Run the mixer tests, motion-pipeline tsc, and scoped ESLint. All must pass.
- [ ] Step 5: Commit with message feat: expose motion mixer inspection.

### Task 2: Expose inspection through the composed pipeline

**Files:**

- Modify: packages/motion-pipeline/src/types.ts
- Modify: packages/motion-pipeline/src/pipeline.ts
- Modify: packages/motion-pipeline/src/pipeline.test.ts

**Interfaces:**

Extend MotionFramePipeline additively:

```ts
inspect?(inputs: readonly MotionFrameInput[]): MotionMixerInspection | undefined;
```

- [ ] Step 1: Write a failing test using a real mixer and retarget mapping { Head: "HeadTarget" }. Assert ownership is returned under HeadTarget. Assert a custom mixer without inspect returns undefined.
- [ ] Step 2: Run the command vitest run packages/motion-pipeline/src/pipeline.test.ts -t inspection and verify the expected missing-method failure.
- [ ] Step 3: Apply the same source filters used by process, call optional mixer inspection, and remap bone ownership through retarget.mapping. Do not catch errors in the pure package.
- [ ] Step 4: Run all packages/motion-pipeline tests.
- [ ] Step 5: Commit with message feat: expose composed motion pipeline inspection.

### Task 3: Implement pure fail-safe frame decisions

**Files:**

- Create: packages/runtime/src/motion-failsafe.ts
- Create: packages/runtime/src/motion-failsafe.test.ts
- Modify: packages/runtime/src/index.ts

**Interfaces:**

```ts
export type MotionFailSafeAction =
  | "hold-last-frame"
  | "blend-to-neutral"
  | "disable-source";

export interface MotionFailSafeOptions {
  timeoutMs: number;
  action: MotionFailSafeAction;
  transitionMs?: number;
}

export interface MotionFailSafeResult {
  stale: boolean;
  frame: MotionFrame | undefined;
}

export function applyMotionFailSafe(
  frame: MotionFrame,
  ageMs: number,
  options: MotionFailSafeOptions,
): MotionFailSafeResult;
```

- [ ] Step 1: Write failing tests for fresh frames, hold-last-frame, disable-source, blend transition boundaries, numeric zero, position zero, identity rotation, scale one, partial fields, and invalid configuration.
- [ ] Step 2: Run the command vitest run packages/runtime/src/motion-failsafe.test.ts and verify the missing-module RED failure.
- [ ] Step 3: Implement immutable frame transitions. Treat age below timeout as fresh. For blend, use factor = clamp(1 - (age - timeout) / transitionMs, 0, 1), retaining only components that existed in the input.
- [ ] Step 4: Run the focused test and scoped Runtime ESLint.
- [ ] Step 5: Commit with message feat: add motion source fail-safe decisions.

### Task 4: Integrate fail-safe configuration and source health

**Files:**

- Modify: packages/runtime/src/runtime.ts
- Modify: packages/runtime/src/runtime.test.ts
- Modify: packages/runtime/src/index.ts

**Interfaces:**

```ts
configureMotionFailSafe(options: MotionFailSafeOptions): this;
getMotionFailSafe(): MotionFailSafeOptions | undefined;
```

- [ ] Step 1: Write failing Runtime tests for default raw delivery, stale disable, stale hold, stale blend, and stop reset. Use timeoutMs 0 for deterministic stale integration coverage.
- [ ] Step 2: Run the command vitest run packages/runtime/src/runtime.test.ts -t fail-safe and verify RED.
- [ ] Step 3: Track local receipt time, connected state, last frame timestamp, and bounded receipt history per source. Apply decisions before source filters and mixer processing. Keep source order and existing error isolation.
- [ ] Step 4: Run the complete Runtime test file.
- [ ] Step 5: Commit with message feat: integrate motion source fail-safe.

### Task 5: Add Runtime Inspector snapshots and output telemetry

**Files:**

- Create: packages/runtime/src/motion-inspector.ts
- Create: packages/runtime/src/motion-inspector.test.ts
- Modify: packages/runtime/src/runtime.ts
- Modify: packages/runtime/src/runtime.test.ts
- Modify: packages/runtime/src/index.ts

**Interfaces:**

```ts
export interface MotionSourceInspectorSnapshot {
  id: string;
  connected: boolean;
  stale: boolean;
  inputRateHz: number;
  lastFrameAt?: number;
  lastFrameTimestamp?: number;
  ageMs?: number;
}

export interface MotionOutputInspectorSnapshot {
  id: string;
  connected: boolean;
  outputRateHz: number;
  lastOutputAt?: number;
  error?: string;
}

export interface MotionInspectorSnapshot {
  timestamp: number;
  running: boolean;
  sources: MotionSourceInspectorSnapshot[];
  mixer: MotionMixerInspection | undefined;
  outputs: MotionOutputInspectorSnapshot[];
}

getMotionInspectorSnapshot(): MotionInspectorSnapshot;
```

- [ ] Step 1: Write failing unit tests for bounded rate calculation with zero, one, and repeated events. Write Runtime tests for source health, successful frame/legacy output rates, and adapter errors.
- [ ] Step 2: Run the command vitest run packages/runtime/src/motion-inspector.test.ts packages/runtime/src/runtime.test.ts -t inspector and verify RED.
- [ ] Step 3: Use a one-second event window. Record successful output updates, error strings, connection recovery after a later success, and reset all histories on stop. Return defensive arrays and records.
- [ ] Step 4: During canonical dispatch, call optional pipeline.inspect(inputs), catch/log inspection failures, and store undefined on failure without affecting output delivery.
- [ ] Step 5: Run Runtime tests, Runtime build, and scoped Runtime ESLint.
- [ ] Step 6: Commit with message feat: add runtime motion inspector.

### Task 6: Documentation and completion verification

**Files:**

- Create: docs/reference/motion-failsafe.md
- Create: docs/reference/motion-inspector.md
- Modify: .codex/tasks/motion-runtime-phase3.md

- [ ] Step 1: Document Runtime methods, default-disabled behavior, stale semantics, neutral targets, snapshot fields, and deferred transport exposure. Use TypeScript examples only.
- [ ] Step 2: Run scoped Prettier, motion-pipeline tests, Runtime tests, and the full Vitest suite.
- [ ] Step 3: Commit only the two documentation files with message docs: document motion fail-safe and inspector; keep .codex task state local if repository policy leaves it untracked.
- [ ] Step 4: Add one concise Implementation/Verification/Notes comment to Plane work item PUPPETFL-3 and move it to the existing Review state, never Done.
