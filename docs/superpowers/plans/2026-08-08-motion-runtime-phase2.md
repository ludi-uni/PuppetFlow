# PuppetFlow Motion Runtime Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add an opt-in source-filter, priority/weight mixer, and bone-retarget pipeline for canonical `MotionFrame` values while preserving Phase 1 raw delivery and all legacy runtime APIs.

**Architecture:** Create a dependency-light `@puppetflow/motion-pipeline` package containing pure mixer, retarget, filter, quaternion, and pipeline composition code. Add one additive `attachMotionPipeline()` seam to `PuppetFlowRuntime`; with no pipeline attached, the existing per-source frame delivery remains unchanged, while an attached pipeline produces one processed frame per tick for frame-capable adapters.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, tsup, `@puppetflow/core` `MotionFrame` types, no Node/UDP/Tauri dependency.

## Global Constraints

- Preserve existing `MotionState`, PFScript, `StateSource`, `Adapter`, Phase 1 `MotionSource`, `MotionFrameAdapter`, CLI, YAML, and VMC behavior.
- Do not change VMC protocol validation or add live UDP/interoperability tests.
- Keep the processing package pure and transport-independent.
- Preserve partial transforms and unknown bone IDs; never synthesize missing position, rotation, or scale.
- Resolve mixer priority per transform component and numeric channel; same-priority candidates use weighted blending.
- Use quaternion hemisphere correction and normalized interpolation; never interpolate Euler angles.
- Filter state must be reset between runtime sessions.
- Do not add YAML/CLI configuration, Fail-safe, Inspector, Motion Graph integration, or Plugin API expansion in this phase.
- Preserve unrelated dirty-worktree files and stage only Phase 2 files owned by this plan.

---

### Task 1: Motion pipeline package contracts and quaternion math

**Files:**

- Create: `packages/motion-pipeline/package.json`
- Create: `packages/motion-pipeline/tsconfig.json`
- Create: `packages/motion-pipeline/src/types.ts`
- Create: `packages/motion-pipeline/src/quaternion.ts`
- Create: `packages/motion-pipeline/src/quaternion.test.ts`
- Create: `packages/motion-pipeline/src/index.ts`
- Modify: `pnpm-lock.yaml` only if workspace metadata requires it

**Interfaces:**

- Consumes: `MotionFrame`, `BoneId`, `BoneTransform`, `Quaternion`, and `Vec3` from `@puppetflow/core`.
- Produces: `MotionFrameInput`, `MotionLayer`, `MotionFrameFilter`, `MotionFramePipeline`, `MotionRetargetProfile`, and tested quaternion helpers.

- [ ] **Step 1: Write failing quaternion and contract tests**

Add tests for quaternion normalization, shortest-hemisphere alignment, weighted nlerp, and identity multiplication. Include a test that the package exports the declared pipeline contracts.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm exec vitest run packages/motion-pipeline/src/quaternion.test.ts`

Expected: FAIL because the package and quaternion module do not exist.

- [ ] **Step 3: Implement minimal package and quaternion helpers**

Implement the workspace package, public types, finite-value-safe quaternion normalization, multiplication, dot-product hemisphere correction, and weighted normalized interpolation. Do not add filter or mixer behavior yet.

- [ ] **Step 4: Run focused tests and build**

Run: `pnpm exec vitest run packages/motion-pipeline/src/quaternion.test.ts` and `pnpm --filter @puppetflow/motion-pipeline build`.

Expected: PASS.

- [ ] **Step 5: Commit bounded package setup**

```powershell
git add packages/motion-pipeline pnpm-lock.yaml
git commit -m "feat: add motion pipeline contracts"
```

### Task 2: Priority/weight MotionMixer

**Files:**

- Create: `packages/motion-pipeline/src/mixer.ts`
- Create: `packages/motion-pipeline/src/mixer.test.ts`
- Modify: `packages/motion-pipeline/src/index.ts`

**Interfaces:**

- Consumes: `MotionFrameInput`, `MotionLayer`, `MotionFrame`, and quaternion helpers.
- Produces: `MotionMixer` and `createMotionMixer(layers)`.

- [ ] **Step 1: Write failing mixer tests**

Cover: highest-priority override, same-priority weighted numeric blend, bone mask, blendShape mask, parameter mask, missing layer/source, partial transform preservation, and opposite-sign quaternion blending without a flip.

- [ ] **Step 2: Run mixer tests and verify RED**

Run: `pnpm exec vitest run packages/motion-pipeline/src/mixer.test.ts`

Expected: FAIL because `MotionMixer` is not implemented.

- [ ] **Step 3: Implement component-level candidate resolution**

Assign frames to layers by `sourceId`, defaulting an unconfigured source to priority `0` and weight `1`. For each bone position/rotation/scale and each numeric channel, retain only the highest-priority eligible candidates, apply masks and non-negative weights, then blend same-priority values. Preserve partial fields and return `undefined` for empty input. Set mixer metadata with the maximum timestamp and contributing source IDs.

- [ ] **Step 4: Run mixer and package tests/build**

Run: `pnpm exec vitest run packages/motion-pipeline/src/mixer.test.ts packages/motion-pipeline/src/quaternion.test.ts` and `pnpm --filter @puppetflow/motion-pipeline build`.

Expected: PASS.

- [ ] **Step 5: Commit mixer**

```powershell
git add packages/motion-pipeline/src/mixer.ts packages/motion-pipeline/src/mixer.test.ts packages/motion-pipeline/src/index.ts
git commit -m "feat: add priority weighted motion mixer"
```

### Task 3: Bone Retargeting

**Files:**

- Create: `packages/motion-pipeline/src/retarget.ts`
- Create: `packages/motion-pipeline/src/retarget.test.ts`
- Modify: `packages/motion-pipeline/src/index.ts`

**Interfaces:**

- Consumes: `MotionFrame`, `MotionRetargetProfile`, `BoneTransform`, and quaternion helpers.
- Produces: `applyRetarget(frame, profile)`.

- [ ] **Step 1: Write failing retarget tests**

Cover bone mapping, rotation offset multiplication, position offset after scale, missing mapping identity behavior, missing optional transform components, unknown bones, and metadata/timestamp preservation.

- [ ] **Step 2: Run retarget tests and verify RED**

Run: `pnpm exec vitest run packages/motion-pipeline/src/retarget.test.ts`

Expected: FAIL because `applyRetarget` is not implemented.

- [ ] **Step 3: Implement pure retarget transform**

Map each input bone to `profile.mapping[boneId]` or itself. Apply per-input-bone uniform position scale, add the position offset, multiply rotation by the configured quaternion offset, and preserve scale/confidence/partial fields. Merge mapped collisions without inventing absent components.

- [ ] **Step 4: Run retarget and package tests/build**

Run: `pnpm exec vitest run packages/motion-pipeline/src/retarget.test.ts packages/motion-pipeline/src/*.test.ts` and `pnpm --filter @puppetflow/motion-pipeline build`.

Expected: PASS.

- [ ] **Step 5: Commit retarget**

```powershell
git add packages/motion-pipeline/src/retarget.ts packages/motion-pipeline/src/retarget.test.ts packages/motion-pipeline/src/index.ts
git commit -m "feat: add motion bone retargeting"
```

### Task 4: Filter primitives and chain

**Files:**

- Create: `packages/motion-pipeline/src/filters.ts`
- Create: `packages/motion-pipeline/src/filters.test.ts`
- Modify: `packages/motion-pipeline/src/index.ts`

**Interfaces:**

- Consumes: `MotionFrame`, `MotionFrameFilter`, `BoneId`, and quaternion helpers.
- Produces: `createDeadzoneFilter`, `createClampFilter`, `createLowPassFilter`, and `MotionFilterPipeline`.

- [ ] **Step 1: Write failing filter tests**

Cover deadzone zeroing for blendShapes/parameters, numeric clamp, low-pass convergence across calls, quaternion low-pass shortest path, bone/channel masks, chain ordering, reset clearing history, and preservation of unselected frame fields.

- [ ] **Step 2: Run filter tests and verify RED**

Run: `pnpm exec vitest run packages/motion-pipeline/src/filters.test.ts`

Expected: FAIL because the filter factories and chain are not implemented.

- [ ] **Step 3: Implement filter factories and stateful chain**

Use immutable frame copies for every filter. Apply numeric filters to selected blendShape and parameter keys, and low-pass position/rotation/scale to selected bones. Use normalized quaternion nlerp for rotation, maintain state by stable channel/bone key, validate finite ranges, and expose `reset()`.

- [ ] **Step 4: Run filter and package tests/build**

Run: `pnpm exec vitest run packages/motion-pipeline/src/filters.test.ts packages/motion-pipeline/src/*.test.ts` and `pnpm --filter @puppetflow/motion-pipeline build`.

Expected: PASS.

- [ ] **Step 5: Commit filters**

```powershell
git add packages/motion-pipeline/src/filters.ts packages/motion-pipeline/src/filters.test.ts packages/motion-pipeline/src/index.ts
git commit -m "feat: add motion frame filters"
```

### Task 5: Composed MotionFramePipeline

**Files:**

- Create: `packages/motion-pipeline/src/pipeline.ts`
- Create: `packages/motion-pipeline/src/pipeline.test.ts`
- Modify: `packages/motion-pipeline/src/index.ts`

**Interfaces:**

- Consumes: `MotionFrameInput`, `MotionMixer`, `MotionRetargetProfile`, source/output `MotionFrameFilter[]`.
- Produces: `createMotionFramePipeline(options)` implementing `MotionFramePipeline`.

- [ ] **Step 1: Write failing pipeline tests**

Assert exact stage order `source filters → mixer → retarget → output filters`, undefined for empty input, one output frame per input batch, and reset forwarding to all stateful filters.

- [ ] **Step 2: Run pipeline tests and verify RED**

Run: `pnpm exec vitest run packages/motion-pipeline/src/pipeline.test.ts`

Expected: FAIL because the composed pipeline is not implemented.

- [ ] **Step 3: Implement pipeline composition**

Apply filters grouped by source ID, mix the resulting inputs, retarget the mixed frame when configured, then apply output filters. Keep `process()` deterministic and return a new frame; `reset()` clears every configured filter.

- [ ] **Step 4: Run all package tests/build**

Run: `pnpm --filter @puppetflow/motion-pipeline test` and `pnpm --filter @puppetflow/motion-pipeline build`.

Expected: PASS.

- [ ] **Step 5: Commit composed pipeline**

```powershell
git add packages/motion-pipeline/src/pipeline.ts packages/motion-pipeline/src/pipeline.test.ts packages/motion-pipeline/src/index.ts
git commit -m "feat: compose motion frame processing pipeline"
```

### Task 6: Runtime opt-in pipeline integration

**Files:**

- Modify: `packages/runtime/package.json`
- Modify: `packages/runtime/src/runtime.ts`
- Modify: `packages/runtime/src/index.ts`
- Modify: `packages/runtime/src/runtime.test.ts`

**Interfaces:**

- Consumes: `MotionFramePipeline` and `MotionFrameInput` from `@puppetflow/motion-pipeline`.
- Produces: `attachMotionPipeline(pipeline)`, `getMotionPipeline()`, and reset/error-isolated runtime integration.

- [ ] **Step 1: Write failing Runtime integration tests**

Cover processed delivery to one frame adapter, source attachment ordering, raw delivery compatibility when no pipeline is attached, pipeline reset on stop, and a throwing pipeline not blocking legacy adapters.

- [ ] **Step 2: Run focused Runtime tests and verify RED**

Run: `pnpm exec vitest run packages/runtime/src/runtime.test.ts -t "motion pipeline"`

Expected: FAIL because Runtime has no pipeline attachment or processing branch.

- [ ] **Step 3: Implement additive Runtime seam**

Add one optional pipeline field and attachment/getter. In the canonical frame dispatch section, build ordered latest source inputs; use the pipeline branch when attached, otherwise keep the Phase 1 nested source/adapter loop. Reset the pipeline after motion sources stop and catch/log processing errors without changing legacy output.

- [ ] **Step 4: Run Runtime tests/build and regression tests**

Run: `pnpm exec vitest run packages/runtime/src/runtime.test.ts` and `pnpm --filter @puppetflow/runtime build`.

Expected: PASS.

- [ ] **Step 5: Commit Runtime integration**

```powershell
git add packages/runtime/package.json packages/runtime/src
git commit -m "feat: integrate motion pipeline with runtime"
```

### Task 7: Documentation and no-hardware multi-source example

**Files:**

- Create: `docs/reference/motion-mixer.md`
- Create: `docs/reference/motion-retarget.md`
- Create: `docs/reference/motion-filters.md`
- Create: `examples/motion-mixer/README.md`
- Create: `examples/motion-mixer/pipeline.ts`
- Modify: `docs/architecture.md` only if the Phase 2 section can be added without including unrelated conflict-marker changes

**Interfaces:**

- Consumes: public `@puppetflow/motion-pipeline` TypeScript APIs and `PuppetFlowRuntime.attachMotionPipeline`.
- Produces: usage documentation for masks, layers, retarget profiles, filter chains, stage order, and deferred YAML/CLI configuration.

- [ ] **Step 1: Write the executable example and docs**

Show two synthetic sources (`body-replay` and `head-script`) feeding a mixer with masks, a retarget mapping, a low-pass output filter, and a VMC-capable frame adapter seam. Document that it runs without hardware and that YAML/CLI configuration is intentionally deferred.

- [ ] **Step 2: Run the example's typecheck/test path**

Run the package build and the example through the workspace TypeScript test/build command available without starting a UDP socket.

Expected: PASS with no live VMC dependency.

- [ ] **Step 3: Format and commit docs/example**

```powershell
git add docs/reference/motion-mixer.md docs/reference/motion-retarget.md docs/reference/motion-filters.md examples/motion-mixer
git commit -m "docs: document motion pipeline phase 2"
```

### Task 8: Cross-package verification and Plane Review submission

**Files:**

- Modify: `.codex/tasks/motion-runtime-phase2.md`
- Modify: `docs/superpowers/plans/2026-08-08-motion-runtime-phase2.md` as checklist progress requires

**Interfaces:**

- Consumes: all Phase 2 APIs and test evidence.
- Produces: final diff review, verification evidence, and Plane task state Review.

- [ ] **Step 1: Run closest tests and target package tests**

Run package tests in order: motion-pipeline, runtime, then the full repository suite.

- [ ] **Step 2: Run builds and checks**

Run the motion-pipeline and runtime builds, local ESLint, `git diff --check`, and relevant documentation formatting. Use the local binaries if the project-pinned pnpm launcher cannot run without network access.

- [ ] **Step 3: Review compatibility and scope**

Confirm no legacy adapter/source behavior changed without pipeline attachment, no VMC Lab responsibility was added, and unrelated dirty files remain untouched.

- [ ] **Step 4: Update task state and Plane**

Record changed files, test results, limitations, and the exact branch/commit in `.codex/tasks/motion-runtime-phase2.md`. Add one concise Plane implementation/verification/notes comment and move `PUPPETFL-3` to the existing Review state, never Done.

- [ ] **Step 5: Commit task state only if it is owned and safe**

Do not stage pre-existing dirty files; leave `.codex` task state uncommitted if its parent directory was already untracked.
