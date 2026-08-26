# Task State

## Objective

- Implement Phase 1 of the PuppetFlow motion runtime expansion: canonical MotionFrame, VMC Bone Pose output, MotionSource, and streaming Record/Replay.

## Scope

### Included

- Additive MotionFrame model in `@puppetflow/core`.
- MotionFrameAdapter capability and VMC OSC Bundle/Bone Pose output.
- MotionSource and MotionState wrapper.
- Runtime latest-frame source/adapter routing.
- Node JSONL record/replay package and CLI commands.
- Tauri frame transport, focused docs, and a no-hardware example.

### Excluded

- Mixer, filters, retarget/calibration, fail-safe, Inspector, Motion Graph canonical integration, Plugin API extension.
- VMC receive/validation, malformed packets, dedicated omit-bones scenarios, interoperability testing, VRM rendering, GUI, animation editor, full IK.
- Unrelated existing dirty-worktree changes.

## Decisions

- Existing MotionState, StateSource, Adapter, PFScript, Graph, CLI run command, and YAML config remain compatible.
- MotionFrame timestamps use milliseconds; source-relative time is never treated as Unix time.
- Partial canonical transforms are retained; VMC emits Bone/Pos only for complete position+rotation pairs.
- Phase 1 has no Mixer; multiple source frames are delivered deterministically in attachment order.
- Implementation follows `docs/superpowers/specs/2026-08-08-motion-runtime-phase1-design.md` and `docs/superpowers/plans/2026-08-08-motion-runtime-phase1.md`.

## Files

### Read

- `docs/superpowers/specs/2026-08-08-motion-runtime-phase1-design.md`
- `docs/superpowers/plans/2026-08-08-motion-runtime-phase1.md`
- Existing core, adapter, source, runtime, launcher, CLI, docs, examples, and Tauri files listed in the plan.

### Changed

- `packages/core/src/motion-frame.ts` — canonical frame types, validation, and cloning.
- `packages/core/src/motion-frame.test.ts` — partial/unknown-bone, blendshape, validation, and clone coverage.
- `packages/core/src/index.ts` — public exports for the canonical frame API.
- `packages/adapter-core/src/adapter.ts` and `packages/adapter-core/src/index.ts` — additive `MotionFrameAdapter` capability.
- `packages/adapter-vmc/src/osc-encoder.ts` and `osc-bundle.ts` — pure VMC Bone/Pos and OSC Bundle encoders.
- `packages/adapter-vmc/src/node-osc-adapter.ts` and `node-vmc-adapter.ts` — injected transport, canonical frame output, rate limiting, and timestamp handling.
- `packages/adapter-vmc/src/*test.ts` — pure encoder and UDP-free Node VMC coverage.
- `packages/source-core/src/motion-source.ts` — additive `MotionSource` and emitter contracts.
- `packages/source-core/src/motion-state-frame-source.ts` — interval-based legacy MotionState wrapper.
- `packages/source-core/src/*motion*test.ts` — source lifecycle and parameter serialization coverage.
- `packages/runtime/src/runtime.ts` and `index.ts` — additive source/frame-adapter lifecycle, latest-frame routing, normalization, and identity deduplication.
- `packages/runtime/src/runtime.test.ts` — source ordering, stop cleanup, and dual-capability adapter lifecycle coverage.
- `packages/motion-recording` — Node-only JSONL writer/streaming reader and lazy ReplaySource with speed, loop, offset, and cancellation.
- `apps/cli/src/cli.ts` and `commands/{record,replay}.ts` — opt-in `pf record`/`pf replay` commands and validation.
- `apps/cli/src/*test.ts` — Commander parsing and command validation coverage.
- `packages/runtime-launcher/src/*` — configured VMC registered as both legacy and frame adapter with deduplicated runtime lifecycle; output-rate/timestamp options.
- `packages/cli-config/src/mapper-yaml.ts` — YAML parsing/preservation for VMC output-rate/timestamp options.
- `apps/studio/src-tauri/src/lib.rs` and `apps/playground/src-tauri/src/lib.rs` — canonical frame OSC transport commands.
- `docs/reference/*` and `examples/motion-replay/*` — frame, source, VMC, record/replay references and no-hardware example.

## Acceptance criteria

- [x] Existing legacy tests and APIs remain compatible.
- [x] MotionFrame supports blendshape-only, bone-only, mixed, partial, and unknown-bone frames.
- [x] VMC Bone/Pos and OSC Bundle encoding is tested without UDP.
- [x] MotionSource frames reach frame-capable adapters through Runtime lifecycle.
- [x] JSONL record/replay preserves timestamps and metadata and supports speed, loop, and offset.
- [x] `pf record` and `pf replay` are available without changing `pf run` or YAML compatibility.
- [x] Documentation and no-hardware example are present.
- [x] Verification evidence is recorded and Plane task is moved to Review, not Done.

## Tests

- Baseline: core, adapter-vmc, source-core, runtime tests before implementation.
- Task 1 RED: missing `./motion-frame.js` module as expected.
- Task 1 GREEN: `pnpm exec vitest run packages/core/src/motion-frame.test.ts` (2 passed).
- Task 1 regression: `pnpm exec vitest run packages/core` (21 passed).
- Task 1 type/build: `pnpm --filter @puppetflow/core build` (passed).
- Task 2 RED: missing Bone/Pos export and OSC Bundle module as expected.
- Task 2 GREEN: encoder/bundle tests (6 passed).
- Task 2 type/build: `pnpm --filter @puppetflow/adapter-core build` and `pnpm --filter @puppetflow/adapter-vmc build` (passed).
- Task 3 GREEN: Node VMC tests (5 passed), all VMC tests (11 passed), and VMC build (passed).
- Task 4 RED: missing MotionState wrapper module as expected.
- Task 4 GREEN: source tests (3 passed) and source-core build (passed).
- Task 5 RED: missing `attachMotionSource`/`attachMotionAdapter` methods as expected.
- Task 5 GREEN: runtime tests (17 passed) and runtime build (passed).
- Task 6 RED: missing recorder/replay modules as expected.
- Task 6 GREEN: recording/replay tests (4 passed) and motion-recording build (passed).
- Workspace install: `pnpm install` linked the new package and updated `pnpm-lock.yaml`; offline install could not resolve cached bundle-require metadata before the online retry.
- Task 7 RED: missing CLI program/command modules as expected.
- Task 7 GREEN: CLI/YAML/launcher tests (9 passed; launcher build-runtime and mapper tests included), cli-config/runtime-launcher/CLI builds passed.
- Task 8 GREEN: Studio and Playground `cargo check` passed; both `cargo fmt --check` passed; sample JSONL read back 3 frames.
- Per-task RED/GREEN focused tests from the implementation plan.
- Final: local ESLint passed; Vitest full suite passed (111 files, 413 tests); motion-recording build passed; both Tauri compile and format checks passed.
- Final workspace build passed before the lint-only follow-up commit; the follow-up motion-recording build also passed after it.
- Full Prettier check remains blocked by pre-existing conflict markers in unrelated dirty files (`.github/workflows/ci.yml` and several root docs); new Phase 1 docs were checked separately.

## Open questions

- Live UDP/Tauri/VMC interoperability remains unrun and must be reported as such.
- Full repository `pnpm verify` and full Prettier check may be affected by unrelated dirty changes and generated preset state.
- `pnpm` was unavailable for the final rerun because its global launcher attempted to fetch the project-pinned version; equivalent local ESLint/Vitest/tsup commands were used for the final code state.

## Next action

- Implementation is committed through `a66e714` on `codex/motion-runtime-phase1`; preserve unrelated dirty files and leave the Plane task in Review for human verification.
