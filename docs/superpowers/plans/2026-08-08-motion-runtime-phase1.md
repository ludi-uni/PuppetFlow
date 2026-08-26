# PuppetFlow Motion Runtime Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, protocol-independent `MotionFrame` path with VMC Bone Pose output and streaming Record/Replay while preserving every existing `MotionState`, StateSource, Adapter, PFScript, CLI, and YAML contract.

**Architecture:** Extend `@puppetflow/core` with the canonical frame model, add `MotionSource` and `MotionFrameAdapter` capabilities beside the legacy interfaces, and route source-local latest frames through the existing `PuppetFlowRuntime`. Put Node JSONL recording and lazy replay in a new `@puppetflow/motion-recording` package; keep VMC encoding pure and transport-independent so UDP/Tauri integration is thin and testable.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, tsup, Node `dgram`/`fs`/`readline`, Tauri Rust `rosc`, Commander, YAML.

## Global Constraints

- Existing `MotionState`, PFScript, Motion Graph, StateSource, Adapter, BlendShape mapping, WebSocket/MQTT sources, `pf run`, and YAML versions remain compatible.
- Canonical `MotionFrame.timestamp` is milliseconds; source-relative timestamps are never guessed to be Unix time.
- Unknown bone IDs are retained; partial canonical transforms are valid.
- VMC emits `/VMC/Ext/Bone/Pos` only when both position and quaternion exist; it never invents missing transforms.
- VMC Lab validation, malformed packets, dedicated omit-bones scenarios, interoperability tests, GUI, VRM rendering, full IK, Mixer, Retarget, Filters, Fail-safe, Inspector, and Motion Graph canonical integration are out of scope.
- Tests must not require UDP or live Tauri/VMC integrations.
- Preserve unrelated dirty-worktree changes and stage only files owned by this plan.
- Run closest tests first, then package tests, type/build checks, lint/format, and required repository verification as feasible with the pre-existing dirty worktree.

---

### Task 1: Canonical MotionFrame model in core

**Files:**

- Create: `packages/core/src/motion-frame.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/motion-frame.test.ts`

**Interfaces:**

- Consumes: no new package dependencies.
- Produces: `BoneId`, `Vec3`, `Quaternion`, `BoneTransform`, `MotionMetadata`, `MotionFrame`, `cloneMotionFrame(frame)`, and `normalizeMotionFrame(value)` from `@puppetflow/core`.

- [ ] **Step 1: Write the failing tests**

```ts
it("accepts blendshape-only, bone-only, mixed, partial, and unknown bones", () => {
  const frame = normalizeMotionFrame({
    timestamp: 16,
    bones: {
      UnknownBone: { rotation: { x: 0, y: 0, z: 0, w: 1 } },
    },
    blendShapes: { Smile: 0.4 },
  });
  expect(frame.bones?.UnknownBone.rotation?.w).toBe(1);
  expect(frame.blendShapes?.Smile).toBe(0.4);
});

it("rejects non-finite timestamps and clones nested records", () => {
  expect(() => normalizeMotionFrame({ timestamp: Number.NaN })).toThrow();
  const original = normalizeMotionFrame({ timestamp: 0, bones: { Head: {} } });
  const copy = cloneMotionFrame(original);
  expect(copy).not.toBe(original);
  expect(copy.bones).not.toBe(original.bones);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec vitest run packages/core/src/motion-frame.test.ts`

Expected: FAIL because the new module and exports do not exist.

- [ ] **Step 3: Implement the minimal model and normalizer**

Implement finite-number checks for timestamp, sequence, vector/quaternion components, confidence, blendshape values, and parameter values. Copy only recognized frame fields, preserve arbitrary bone IDs and metadata, and deep-copy the known nested records. Do not clamp protocol-independent values.

- [ ] **Step 4: Run the focused test and package test**

Run: `pnpm exec vitest run packages/core/src/motion-frame.test.ts packages/core/src/*.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the bounded core change**

```powershell
git add packages/core/src/motion-frame.ts packages/core/src/motion-frame.test.ts packages/core/src/index.ts
git commit -m "feat: add canonical motion frame model"
```

### Task 2: MotionFrameAdapter and VMC pure encoder

**Files:**

- Modify: `packages/adapter-core/src/adapter.ts`
- Modify: `packages/adapter-core/src/index.ts`
- Modify: `packages/adapter-vmc/src/osc-encoder.ts`
- Modify: `packages/adapter-vmc/src/osc-encoder.test.ts`
- Create: `packages/adapter-vmc/src/osc-bundle.ts`
- Create: `packages/adapter-vmc/src/osc-bundle.test.ts`
- Modify: `packages/adapter-vmc/src/types.ts`

**Interfaces:**

- Consumes: `MotionFrame`, `BoneTransform` from `@puppetflow/core`.
- Produces: `MotionFrameAdapter`; `encodeBonePoseMessage(name, transform)`; `encodeOscBundle(messages, timetag)`; VMC bundle timestamp and output-rate config types.

- [ ] **Step 1: Write the failing adapter and encoder tests**

```ts
it("encodes VMC Bone/Pos with position and quaternion in x,y,z,w order", () => {
  const packet = encodeBonePoseMessage("Head", {
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0.1, y: 0.2, z: 0.3, w: 0.4 },
  });
  expect(new TextDecoder().decode(packet)).toContain("/VMC/Ext/Bone/Pos");
  expect(readFloatArguments(packet)).toEqual([1, 2, 3, 0.1, 0.2, 0.3, 0.4]);
});

it("omits a partial bone instead of synthesizing a transform", () => {
  expect(
    encodeBonePoseMessage("Head", { rotation: { x: 0, y: 0, z: 0, w: 1 } }),
  ).toBeNull();
});
```

Use a small byte-reading helper in the test instead of a UDP socket. Assert the OSC address, `,sfffffff` type tag, string name, seven float values, OSC padding, bundle element sizes, and timetag bytes.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm exec vitest run packages/adapter-vmc/src/osc-encoder.test.ts packages/adapter-vmc/src/osc-bundle.test.ts`

Expected: FAIL because Bone Pose and Bundle encoders do not exist.

- [ ] **Step 3: Implement pure OSC message and Bundle encoding**

Reuse the existing string/float/padding helpers. Encode `/VMC/Ext/Bone/Pos` with the official eight arguments and create `#bundle` packets with an eight-byte OSC timetag and four-byte element sizes. Support `immediate`, `send-time`, and `frame-unix` resolution without treating relative timestamps as Unix timestamps.

- [ ] **Step 4: Run the focused tests and existing adapter tests**

Run: `pnpm exec vitest run packages/adapter-vmc/src/osc-encoder.test.ts packages/adapter-vmc/src/osc-bundle.test.ts packages/adapter-vmc/src/*.test.ts`

Expected: PASS, including the pre-existing BlendShape encoder test.

- [ ] **Step 5: Commit the pure adapter-core/VMC encoder change**

```powershell
git add packages/adapter-core/src packages/adapter-vmc/src/osc-encoder.ts packages/adapter-vmc/src/osc-encoder.test.ts packages/adapter-vmc/src/osc-bundle.ts packages/adapter-vmc/src/osc-bundle.test.ts packages/adapter-vmc/src/types.ts
git commit -m "feat: add VMC bone pose bundle encoding"
```

### Task 3: Node VMC frame output and transport seam

**Files:**

- Modify: `packages/adapter-vmc/src/node-osc-adapter.ts`
- Modify: `packages/adapter-vmc/src/node-vmc-adapter.ts`
- Modify: `packages/adapter-vmc/src/node.ts`
- Modify: `packages/adapter-vmc/src/index.ts`
- Modify: `packages/adapter-vmc/src/types.ts`
- Test: `packages/adapter-vmc/src/node-osc-adapter.test.ts`
- Test: `packages/adapter-vmc/src/node-vmc-adapter.test.ts`

**Interfaces:**

- Consumes: `MotionFrameAdapter`, pure encoder functions, existing `MotionMapperProfile`.
- Produces: `NodeOscAdapter.updateFrame(frame, deltaTime)` and `NodeVmcAdapter.updateFrame(frame, deltaTime)` with injected `OscTransport` for tests.

- [ ] **Step 1: Write failing frame-output tests with a recording transport**

```ts
const sent: Uint8Array[] = [];
const transport = { send: async (packet: Uint8Array) => sent.push(packet) };

it("sends one Bundle for complete bone and blendshape frame", async () => {
  const adapter = new NodeOscAdapter({ id: "test", profile: VMC_PROFILE, transport });
  await adapter.updateFrame(
    {
      timestamp: 0,
      bones: {
        Head: { position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      },
      blendShapes: { Smile: 0.5 },
    },
    1 / 60,
  );
  expect(sent).toHaveLength(1);
});
```

Add tests for output-rate throttling, parameter mapping, partial-bone omission, and `frame-unix`/`immediate` modes. No real socket is allowed.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm exec vitest run packages/adapter-vmc/src/node-osc-adapter.test.ts packages/adapter-vmc/src/node-vmc-adapter.test.ts`

Expected: FAIL because `updateFrame` and transport injection do not exist.

- [ ] **Step 3: Implement the Node frame path**

Add a transport interface with a default `dgram` implementation. Map `frame.blendShapes` directly, map `frame.parameters` through the existing profile/custom mappings, skip incomplete bones, bundle all messages, and enforce `outputRateHz` using a monotonic clock. Keep legacy `update(MotionState, deltaTime)` behavior byte-for-byte equivalent in message shape and mapping.

- [ ] **Step 4: Run package tests and build**

Run: `pnpm --filter @puppetflow/adapter-vmc test` and `pnpm --filter @puppetflow/adapter-vmc build`

Expected: PASS.

- [ ] **Step 5: Commit the Node VMC frame output**

```powershell
git add packages/adapter-vmc/src
git commit -m "feat: send canonical motion frames through VMC"
```

### Task 4: MotionSource API and legacy MotionState wrapper

**Files:**

- Modify: `packages/source-core/src/state-source.ts`
- Modify: `packages/source-core/src/index.ts`
- Create: `packages/source-core/src/motion-source.ts`
- Create: `packages/source-core/src/motion-state-frame-source.ts`
- Test: `packages/source-core/src/motion-source.test.ts`
- Test: `packages/source-core/src/motion-state-frame-source.test.ts`

**Interfaces:**

- Consumes: `MotionFrame` and `MotionState` from `@puppetflow/core`.
- Produces: `MotionSource`, `MotionFrameEmitter`, and `MotionStateFrameSource`.

- [ ] **Step 1: Write failing lifecycle and wrapper tests**

```ts
it("emits cloned MotionState parameters on its configured interval", async () => {
  vi.useFakeTimers();
  const received: MotionFrame[] = [];
  const source = new MotionStateFrameSource(() => ({
    ...DEFAULT_MOTION_STATE,
    mouthX: 0.7,
  }));
  await source.start((frame) => received.push(frame));
  await vi.advanceTimersByTimeAsync(34);
  expect(received.length).toBeGreaterThanOrEqual(2);
  expect(received[0].parameters?.mouthX).toBe(0.7);
  await source.stop();
  vi.useRealTimers();
});
```

Test that `stop()` prevents further emits and that a source can emit arbitrary unknown bones without the interface filtering them.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm exec vitest run packages/source-core/src/motion-source.test.ts packages/source-core/src/motion-state-frame-source.test.ts`

Expected: FAIL because the new source modules do not exist.

- [ ] **Step 3: Implement the source interfaces and wrapper**

Use a `setInterval` defaulting to `1000 / 60`, a monotonic clock, a source-relative timestamp starting at zero, and a `MotionFrame` with `metadata.sourceType: "motion-state"`. Serialize standard and custom `MotionState` values into `parameters` without changing their values.

- [ ] **Step 4: Run source-core tests and build**

Run: `pnpm --filter @puppetflow/source-core test` and `pnpm --filter @puppetflow/source-core build`

Expected: PASS.

- [ ] **Step 5: Commit the source capability**

```powershell
git add packages/source-core/src
git commit -m "feat: add motion source capability"
```

### Task 5: Runtime frame source/adapter lifecycle

**Files:**

- Modify: `packages/runtime/src/runtime.ts`
- Modify: `packages/runtime/src/index.ts`
- Modify: `packages/runtime/src/runtime.test.ts`

**Interfaces:**

- Consumes: `MotionSource`, `MotionFrame`, and `MotionFrameAdapter`.
- Produces: `attachMotionSource(source)`, `attachMotionAdapter(adapter)`, `getMotionSources()`, and `getMotionFrameAdapters()`.

- [ ] **Step 1: Write failing runtime tests**

Add a fake source and frame adapter. Assert that `start()` calls the source, source emits are cloned into the runtime, each latest frame is delivered in source attachment order, `stop()` removes frames, and an object registered as both legacy and frame adapter is initialized/disposed once.

- [ ] **Step 2: Run the runtime tests and verify RED**

Run: `pnpm exec vitest run packages/runtime/src/runtime.test.ts -t "motion frame"`

Expected: FAIL because the attach methods and frame lifecycle do not exist.

- [ ] **Step 3: Implement additive runtime fields and lifecycle**

Keep `StateSource[]` and legacy `Adapter[]` intact. Add separate frame source/adapter collections, a `Map<string, MotionFrame>` for latest frames, defensive normalization at emission time, and identity-based adapter initialization/disposal deduplication. Start frame sources before the first tick; after legacy rendered motion is ready, send latest canonical frames to frame adapters. Log source/adapter errors using the existing prefixes and continue other work.

- [ ] **Step 4: Run runtime package tests and build**

Run: `pnpm --filter @puppetflow/runtime test` and `pnpm --filter @puppetflow/runtime build`

Expected: PASS, with all existing runtime tests unchanged and passing.

- [ ] **Step 5: Commit runtime integration**

```powershell
git add packages/runtime/src
git commit -m "feat: route motion frames through runtime"
```

### Task 6: Streaming JSONL recording and ReplaySource

**Files:**

- Create: `packages/motion-recording/package.json`
- Create: `packages/motion-recording/tsconfig.json`
- Create: `packages/motion-recording/src/motion-recording.ts`
- Create: `packages/motion-recording/src/replay-source.ts`
- Create: `packages/motion-recording/src/index.ts`
- Create: `packages/motion-recording/src/motion-recording.test.ts`
- Create: `packages/motion-recording/src/replay-source.test.ts`
- Modify: `pnpm-lock.yaml` only if pnpm updates workspace metadata

**Interfaces:**

- Consumes: `MotionFrame`, `normalizeMotionFrame`, and `MotionSource`.
- Produces: `MotionFrameRecorder`, `readMotionRecording(path)`, `ReplaySource`, and `MotionRecordingHeader`.

- [ ] **Step 1: Write failing round-trip and playback tests**

```ts
it("records and streams frames while preserving timestamps and metadata", async () => {
  const path = await tempPath("session.pfmotion");
  const recorder = new MotionFrameRecorder(path, { metadata: { test: true } });
  await recorder.start();
  await recorder.record({
    timestamp: 0,
    metadata: { sourceId: "replay" },
    bones: { Head: {} },
  });
  await recorder.record({ timestamp: 16, parameters: { mouthX: 0.4 } });
  await recorder.stop();
  expect(await collect(readMotionRecording(path))).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ timestamp: 0 }),
      expect.objectContaining({ timestamp: 16, parameters: { mouthX: 0.4 } }),
    ]),
  );
});
```

Use fake timers for speed, start offset, loop, and stop-cancellation tests. Assert that the reader does not expose an array-loading API and processes one JSONL record at a time.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm exec vitest run packages/motion-recording/src/motion-recording.test.ts packages/motion-recording/src/replay-source.test.ts`

Expected: FAIL because the new workspace package does not exist.

- [ ] **Step 3: Implement the JSONL writer and reader**

Write a required header line followed by `{"type":"frame","frame":...}` lines. Serialize writes through a promise chain and wait for stream drain. Read with `createReadStream` and `readline`, reject malformed headers and malformed frames, skip unknown record types, and close resources in `finally`.

- [ ] **Step 4: Implement ReplaySource scheduling**

Read lazily, skip frames before `startOffsetMs`, delay the first selected frame by `max(0, timestamp - startOffsetMs) / speed`, delay subsequent frames by non-negative timestamp deltas divided by speed, restart at EOF only when loop is enabled, and make `stop()` abort timers and the active read loop.

- [ ] **Step 5: Run package test and build**

Run: `pnpm --filter @puppetflow/motion-recording test` and `pnpm --filter @puppetflow/motion-recording build`

Expected: PASS.

- [ ] **Step 6: Commit the recording package**

```powershell
git add packages/motion-recording pnpm-lock.yaml
git commit -m "feat: add streaming motion record replay"
```

### Task 7: CLI record/replay commands and launcher wiring

**Files:**

- Modify: `apps/cli/package.json`
- Modify: `apps/cli/src/cli.ts`
- Modify: `apps/cli/src/config/run-config.ts`
- Create: `apps/cli/src/commands/record.ts`
- Create: `apps/cli/src/commands/replay.ts`
- Modify: `apps/cli/src/commands/run.ts` only if signal shutdown is extracted for reuse
- Modify: `packages/runtime-launcher/src/attach-node-adapters.ts`
- Modify: `packages/runtime-launcher/src/types.ts`
- Modify: `packages/runtime-launcher/src/index.ts`
- Modify: `packages/runtime-launcher/package.json`
- Test: `apps/cli/src/cli.test.ts`
- Test: `apps/cli/src/commands/record.test.ts`
- Test: `apps/cli/src/commands/replay.test.ts`

**Interfaces:**

- Consumes: `ReplaySource`, `MotionFrameRecorder`, `MotionStateFrameSource`, `PuppetFlowRuntime.attachMotion*`, and `NodeVmcAdapter.updateFrame`.
- Produces: `pf record <output>` and `pf replay <input>` without changing `pf run` flags or YAML parsing.

- [ ] **Step 1: Write failing command parsing tests**

Assert Commander accepts output/input paths, `--speed`, `--loop`, `--start-offset`, `--vmc-host`, `--vmc-port`, `--duration`, and existing source/preset options; invalid speed/offset/ports fail before runtime startup.

- [ ] **Step 2: Run CLI tests and verify RED**

Run: `pnpm exec vitest run apps/cli/src/cli.test.ts apps/cli/src/commands/record.test.ts apps/cli/src/commands/replay.test.ts`

Expected: FAIL because the commands and handlers do not exist.

- [ ] **Step 3: Implement command handlers**

`record` resolves the existing run config, disables adapters by default, attaches `MotionStateFrameSource` and recorder, records until Ctrl+C or `--duration`, then stops recorder and runtime. `replay` builds a bare `PuppetFlowRuntime`, attaches `ReplaySource`, attaches a frame-capable `NodeVmcAdapter`, supports the playback options, and cleanly stops when replay finishes unless looping.

- [ ] **Step 4: Wire runtime-launcher frame-capable VMC creation**

Keep current `attachNodeAdapters` behavior and add only opt-in output-rate/timestamp fields. Ensure a configured VMC instance can be registered for both legacy and frame output without duplicate lifecycle calls.

- [ ] **Step 5: Run CLI package tests/build**

Run: `pnpm --filter @puppetflow/cli test`, `pnpm --filter @puppetflow/cli build`, and `pnpm --filter @puppetflow/runtime-launcher build`.

Expected: PASS.

- [ ] **Step 6: Commit the CLI integration**

```powershell
git add apps/cli packages/runtime-launcher
git commit -m "feat: add motion record replay CLI commands"
```

### Task 8: Tauri frame transport, documentation, and no-hardware example

**Files:**

- Modify: `packages/adapter-vmc/src/tauri-osc-adapter.ts`
- Modify: `packages/adapter-vmc/src/tauri-vmc-adapter.ts`
- Modify: `apps/studio/src-tauri/src/lib.rs`
- Modify: `apps/playground/src-tauri/src/lib.rs`
- Create: `docs/reference/motion-frame.md`
- Create: `docs/reference/motion-sources.md`
- Create: `docs/reference/record-replay.md`
- Create: `docs/reference/vmc-bone-output.md`
- Modify: `docs/architecture.md`
- Create: `examples/motion-replay/session.pfmotion`
- Create: `examples/motion-replay/README.md`

**Interfaces:**

- Consumes: the same `MotionFrameAdapter` and OSC Bundle contract as Node.
- Produces: Tauri Bundle sending through the existing `rosc` socket state and public Phase 1 documentation.

- [ ] **Step 1: Add failing TypeScript contract checks**

Add TypeScript tests that `TauriOscAdapter.updateFrame` invokes the new command payload shape. Keep protocol bytes covered by the pure TypeScript encoder tests; the Rust command is verified by the existing Tauri crate compilation in Step 4.

- [ ] **Step 2: Implement the native Bundle command**

Add a small `osc_send_motion_frame` command to both existing Tauri entrypoints. It accepts host, port, complete bone poses, blendshape messages, and timetag mode, encodes with `rosc`, and sends one UDP Bundle. Do not change `osc_send_blend_params`.

- [ ] **Step 3: Write the focused references and example**

Document the type contract, source lifecycle, JSONL format/options, VMC partial-pose behavior, and exact commands for `pf record`/`pf replay`. Keep the example independent of hardware and explicitly label multi-source Mixer composition as Phase 2.

- [ ] **Step 4: Run documentation/example and native compile checks**

Run: `pnpm format:check -- docs/reference docs/architecture.md examples/motion-replay`, the affected package builds, `cargo check --manifest-path apps/studio/src-tauri/Cargo.toml`, and `cargo check --manifest-path apps/playground/src-tauri/Cargo.toml`. Verify the sample JSONL parses through `readMotionRecording`.

- [ ] **Step 5: Commit Tauri/docs/example changes**

```powershell
git add packages/adapter-vmc/src/tauri-osc-adapter.ts packages/adapter-vmc/src/tauri-vmc-adapter.ts apps/studio/src-tauri/src/lib.rs apps/playground/src-tauri/src/lib.rs docs/reference docs/architecture.md examples/motion-replay
git commit -m "docs: document motion frame record replay path"
```

### Task 9: Cross-package verification and Plane Review submission

**Files:**

- Modify: `.codex/tasks/motion-runtime-phase1.md`
- Modify: `docs/reference/*` only if verification exposes a factual mismatch

**Interfaces:**

- Consumes: all Phase 1 APIs and test evidence from Tasks 1–8.
- Produces: a clean implementation summary, limitations, and Plane state transition to Review.

- [ ] **Step 1: Run closest and target package tests again**

Run the Phase 1 package tests in dependency order: core, adapter-core/VMC, source-core, runtime, motion-recording, runtime-launcher, and CLI.

- [ ] **Step 2: Run type/build checks**

Run: `pnpm build` and the relevant Tauri compile/build command available in the workspace. Report unavailable native/live checks rather than claiming them passed.

- [ ] **Step 3: Run lint/format and repository verification**

Run: `pnpm lint`, `pnpm format:check`, and `pnpm test`. Run `pnpm verify` only if its generated preset diff can be isolated from unrelated dirty changes; otherwise record the exact pre-existing limitation.

- [ ] **Step 4: Review diff and task state**

Check changed-file scope, public API compatibility, generated output, secrets, test evidence, and unrelated worktree preservation. Update the task state with changed files and unresolved live-integration limitations.

- [ ] **Step 5: Submit the Plane work item to Review**

Post the concise Implementation/Verification/Notes summary to `PUPPETFL-3` and move it from In Progress to the existing Review-equivalent state. Do not move it to Done.
