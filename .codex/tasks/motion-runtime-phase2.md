# Task State

## Objective

- Add an opt-in canonical frame processing path for source filters, priority/weight mixing, and bone retargeting while preserving Phase 1 and legacy runtime behavior.

## Scope

### Included

- New pure `@puppetflow/motion-pipeline` package.
- Priority/weight mixer with bone, blendShape, and parameter masks.
- Quaternion-safe retargeting with mapping, rotation/position offsets, and scale.
- Deadzone, clamp, low-pass, and filter-chain APIs.
- Runtime `attachMotionPipeline()` integration.
- Focused tests, public docs, and no-hardware multi-source example.

### Excluded

- YAML/CLI configuration wiring.
- Fail-safe, Inspector, Motion Graph canonical integration, Plugin API expansion.
- VMC protocol validation, UDP interoperability, GUI, VRM rendering, and IK.
- Unrelated existing dirty-worktree changes.

## Decisions

- Package processing is pure and transport-independent; runtime owns only orchestration and error isolation.
- Mixer priority is resolved per transform component and numeric channel; same-priority values use weighted blending.
- Quaternion interpolation uses hemisphere correction plus normalized linear interpolation.
- Missing transforms and unknown bones are retained safely; no values are synthesized.
- Runtime remains on the Phase 1 raw frame path unless a pipeline is explicitly attached.
- Design: `docs/superpowers/specs/2026-08-08-motion-runtime-phase2-design.md`.
- Plan: `docs/superpowers/plans/2026-08-08-motion-runtime-phase2.md`.

## Files

### Read

- Phase 1 MotionFrame, MotionSource, Runtime, adapter-core, modifier-core, CLI config, and runtime launcher files.
- Attached project specification and Phase 2 design/plan.

### Planned changes

- `packages/motion-pipeline` — contracts, quaternion helpers, mixer, retarget, filters, composed pipeline, and tests.
- `packages/runtime` — optional pipeline attachment and canonical dispatch branch.
- `docs/reference/motion-mixer.md`, `motion-retarget.md`, `motion-filters.md` — public usage references.
- `examples/motion-mixer` — synthetic multi-source pipeline example.

## Acceptance criteria

- [x] MotionMixer passes priority, override, weighted blend, mask, missing-source, partial-transform, and quaternion tests.
- [x] Retarget passes mapping, offsets, scale, missing mapping, and partial-transform tests.
- [x] Filters pass deadzone, clamp, low-pass, mask, chain, and reset tests.
- [x] Composed pipeline applies source filters, mixer, retarget, and output filters in order.
- [x] Runtime processes one frame when attached and preserves raw Phase 1 behavior when unattached.
- [x] Runtime isolates pipeline errors and resets filter state on stop.
- [x] Documentation and no-hardware multi-source example are present.
- [ ] Full relevant verification passes and Plane returns to Review, not Done.

## Tests

- Baseline after Phase 1 merge: full Vitest 111 files / 413 tests and ESLint passed.
- Phase 2 package tests: 5 files / 19 tests passed.
- Runtime tests: 19 tests passed.
- Motion pipeline and Runtime builds, package/runtime ESLint, example typecheck, example execution, and scoped Prettier passed.
- Runtime package `tsc --noEmit` remains blocked by pre-existing errors in `runtime.test.ts` at lines 303, 309, 312, and 402; no production source error was reported.
- Full `git diff --check` remains blocked by pre-existing conflict markers in unrelated dirty files.

## Open questions

- Live UDP/Tauri/VMC interoperability remains out of scope and unrun.
- YAML/CLI configuration is intentionally deferred to a later phase.
- Existing full Prettier validation may still be affected by unrelated conflict-marker files.

## Next action

- Run final verification, update Plane `PUPPETFL-3` with the implementation evidence, and move it to the existing Review state.
