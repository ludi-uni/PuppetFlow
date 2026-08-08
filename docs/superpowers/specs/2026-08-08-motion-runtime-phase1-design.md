# PuppetFlow Motion Runtime Phase 1 Design

**Status:** Proposed for implementation after review  
**Date:** 2026-08-08  
**Scope:** Canonical MotionFrame, VMC Bone Pose, MotionSource, Record/Replay

## Goal

Extend PuppetFlow with a protocol-independent motion-frame path while preserving the existing `MotionState`, PFScript, Motion Graph, StateSource, Adapter, BlendShape, CLI, and configuration contracts.

Phase 1 delivers the smallest working vertical slice:

```text
MotionState / ReplaySource
        ↓
   MotionFrame
        ↓
MotionFrameAdapter
        ↓
VMC OSC Bundle / Record file
```

Mixer, retargeting, filtering, fail-safe behavior, inspection, and graph integration remain later phases.

## Existing context

The current runtime has a 60 Hz `PuppetFlowRuntime` loop. Legacy `StateSource` instances update State/Channel/Timeline stores, behavior plugins and PFScript produce `MotionState` partials, modifiers produce rendered `MotionState`, and legacy `Adapter.update(motion, deltaTime)` sends the result. `@puppetflow/adapter-vmc` currently sends `/VMC/Ext/Blend/Val` messages individually.

The repository already contains `motion-graph`, `motion-mapper`, `modifier`, and multiple StateSource/Adapter packages. Phase 1 reuses these seams instead of creating a parallel runtime.

## Design decisions

### 1. Additive canonical model

`@puppetflow/core` gains the following types. Existing `MotionState` remains unchanged.

```ts
export type BoneId = string;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface BoneTransform {
  position?: Vec3;
  rotation?: Quaternion;
  scale?: Vec3;
  confidence?: number;
}

export interface MotionMetadata {
  sourceId?: string;
  sourceType?: string;
  coordinateSpace?: "local" | "world";
  clock?: "relative" | "monotonic" | "unix";
  [key: string]: unknown;
}

export interface MotionFrame {
  timestamp: number;
  sequence?: number;
  bones?: Record<BoneId, BoneTransform>;
  blendShapes?: Record<string, number>;
  parameters?: Record<string, number>;
  metadata?: MotionMetadata;
}
```

`timestamp` is measured in milliseconds. A source-local relative or monotonic clock is the default. A Unix-clock frame must declare `metadata.clock: "unix"`; source-relative timestamps must never be guessed to be Unix time.

Bone IDs are open strings. Unknown bones are retained. `position`, `rotation`, and `scale` are independently optional, so blendshape-only, rotation-only, position-only, partial-bone, and mixed frames are valid canonical values. Rotations are quaternion-only.

The core package provides a small structural validator/normalizer and a defensive frame clone for source boundaries. It checks finite numeric values and basic shape only. It does not validate VMC protocol conformance, bone completeness, humanoid names, or interoperability behavior.

`MotionState` is not automatically converted to `MotionFrame` by the core package. A dedicated wrapper converts the existing rendered state when recording is requested.

### 2. Separate frame capability for adapters

`@puppetflow/adapter-core` adds a frame capability without changing the existing adapter contract:

```ts
export interface MotionFrameAdapter {
  readonly id: string;
  initialize(): Promise<void>;
  updateFrame(frame: MotionFrame, deltaTime: number): Promise<void>;
  dispose(): Promise<void>;
}
```

Existing `Adapter` users and `wrapLegacyAdapter` remain valid. `NodeVmcAdapter` and `TauriVmcAdapter` implement both capabilities. Runtime lifecycle management deduplicates an object registered for both legacy and frame output.

### 3. VMC Bone Pose output

The VMC encoder adds pure functions for:

- `/VMC/Ext/Bone/Pos`: bone name, position `x/y/z`, quaternion `x/y/z/w`;
- `/VMC/Ext/Blend/Val`: existing blendshape representation;
- OSC Bundle: one frame's complete messages with one timetag.

`updateFrame()` emits only bones with both position and rotation. It does not synthesize zero positions or identity rotations for partial canonical data. It emits `blendShapes` by their canonical names and maps `parameters` through the configured motion-mapper profile, allowing recorded legacy `MotionState` output to replay through the existing VMC mapping.

The VMC Protocol specifies Bone Pose as a local pose with a string name, three position floats, and four quaternion floats. PuppetFlow follows that wire shape while keeping the internal model protocol-independent. The source-relative `MotionFrame.timestamp` is not converted into an NTP timetag. Bundle timestamp behavior is configurable:

- `send-time` (default): current wall-clock converted to OSC timetag;
- `immediate`: OSC immediate timetag;
- `frame-unix`: use the frame timestamp only when `metadata.clock === "unix"`.

`outputRateHz` is an optional adapter setting. The default remains the current runtime cadence. The encoder and a transport seam are tested without UDP. Node uses the existing UDP socket; Tauri gets a native Bundle send command using its existing `rosc` transport. No VMC receive, malformed-packet generation, dedicated VMC Lab omit-bones test scenario, conformance check, or interoperability test is added.

### 4. MotionSource and runtime integration

`@puppetflow/source-core` adds:

```ts
export type MotionFrameEmitter = (frame: MotionFrame) => void;

export interface MotionSource {
  readonly id: string;
  start(emit: MotionFrameEmitter): Promise<void>;
  stop(): Promise<void>;
}
```

`StateSource` is unchanged. `PuppetFlowRuntime` adds:

```ts
attachMotionSource(source: MotionSource): this;
attachMotionAdapter(adapter: MotionFrameAdapter): this;
```

When the runtime starts, each MotionSource receives an emitter. The runtime defensively clones the frame and stores the newest frame per source ID. During each tick, it sends the stored frames in source attachment order to each registered MotionFrameAdapter. Phase 1 intentionally has no priority, weight, mask, or conflict resolution; that is the Phase 2 Mixer responsibility.

When a source stops or the runtime stops, its stored frame is removed. A source error is logged and does not stop unrelated sources or adapters. Existing StateSource and legacy Adapter error behavior is preserved.

`MotionStateFrameSource` is a small wrapper around a supplied `() => MotionState` reader. It emits `MotionFrame.parameters` containing standard and custom motion values, allowing the existing PFScript/Graph/Modifier result to be recorded without changing those systems.

### 5. Versioned streaming Record/Replay

New package: `@puppetflow/motion-recording`.

The initial file format is UTF-8 JSON Lines:

```json
{"type":"header","format":"puppetflow-motion","version":1,"timeUnit":"ms","metadata":{}}
{"type":"frame","frame":{"timestamp":0,"sequence":0,"parameters":{"mouthX":0.2}}}
```

The header is required and contains the format name, integer version, time unit, and optional session metadata. Frame records retain the complete `MotionFrame`, including per-frame metadata and timestamps. Readers process one line at a time and do not load the full file. Unknown record types and additional fields are ignored where safe so future fields can be added without invalidating version 1 readers.

`MotionFrameRecorder` writes the header once and frames sequentially. `ReplaySource` reads frames lazily and supports:

- realtime playback;
- `speed` multiplier, with positive finite values only;
- `loop`;
- `startOffsetMs`, skipping frames before the offset while preserving the first emitted frame's relative delay semantics.

Adjacent timestamp differences are divided by speed. Non-increasing timestamps produce a zero delay for that interval; this is a playback policy, not a protocol validation rule. Stop cancels pending timers, the read loop, and looping.

### 6. CLI surface

The existing `pf run` command and YAML schema remain unchanged. Two commands are added:

```text
pf record <output.pfmotion> [run source/preset options] [--duration <ms>]
pf replay <input.pfmotion> [--speed <number>] [--loop] [--start-offset <ms>]
                      [--vmc-host <host>] [--vmc-port <port>]
```

`record` starts the existing runtime, disables output adapters by default, wraps the rendered MotionState with `MotionStateFrameSource`, and records until Ctrl+C or an optional duration. It accepts the existing preset/config/source options so current HTTP, WebSocket, and MQTT inputs can be captured without changing them.

`replay` starts the existing runtime with no preset requirement, attaches `ReplaySource`, and attaches a VMC frame-capable adapter. It does not create a second runtime implementation. VMC output is enabled by default and remains configurable by host and port.

### 7. Documentation and example

Add focused references:

- `docs/reference/motion-frame.md`;
- `docs/reference/motion-sources.md`;
- `docs/reference/record-replay.md`;
- `docs/reference/vmc-bone-output.md`.

Update `docs/architecture.md` with the additive frame path and keep README changes limited to a short link/command summary. Add `examples/motion-replay/` with a small versioned recording and a no-hardware replay command.

The required multi-source composition example is deferred to Phase 2 because Phase 1 deliberately has no Mixer. Phase 1's example demonstrates the real `ReplaySource → MotionFrame → VMC frame output` path and `MotionStateFrameSource → Recorder` path.

## Compatibility and migration

No migration is required for existing presets, PFScript, MotionState consumers, StateSource implementations, Adapter implementations, VMC BlendShape mappings, WebSocket/MQTT sources, or `pf run` configurations.

The new APIs are opt-in. Existing VMC output continues to call `update(MotionState, deltaTime)`. Users who want canonical frame output explicitly attach a MotionSource and a MotionFrameAdapter. Existing legacy adapters continue to work through `wrapLegacyAdapter`.

The only new config fields are opt-in VMC frame settings and new CLI command options. Existing YAML versions remain accepted and unchanged.

## Verification strategy

Tests are added before implementation for each unit and must demonstrate RED before the corresponding implementation:

1. Core MotionFrame shape, partial data, unknown bones, cloning, and finite-value normalization.
2. VMC encoder messages, Bundle boundaries, quaternion order, timetag mode, and partial-pose omission.
3. MotionSource lifecycle, runtime latest-frame delivery, source stop cleanup, legacy MotionState wrapping, and duplicate adapter lifecycle handling.
4. JSONL header/metadata/timestamp round trip, streaming reader, replay speed, loop, offset, and stop cancellation.
5. CLI option parsing and clean shutdown.

Verification order is closest package tests, target package tests, TypeScript/build, lint/format, then the repository's required verification command where the existing dirty worktree permits it. Live UDP/Tauri/VMC interoperability is reported separately and is not claimed from encoder or mock transport tests.

## Phase boundary and follow-up

The Phase 1 code path ends at frame-capable output:

```text
MotionSource
  → MotionFrame
  → MotionFrameAdapter / existing Adapter
```

The intended later path is:

```text
MotionSource
  → MotionFrame
  → Filter Pipeline
  → Motion Mixer
  → Retarget / Calibration
  → Motion Graph
  → Output Filters
  → Output Adapters
```

The following are explicitly out of Phase 1: Mixer, filter pipeline, retargeting/calibration, fail-safe actions, runtime inspector, Motion Graph canonical integration, Plugin API extension, VMC receive/validation/interoperability, malformed packet generation, VRM rendering, GUI editor, animation editor, and full IK.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Existing runtime has a legacy StateSource/Adapter loop | Keep new interfaces separate and add opt-in attach methods. |
| Multiple frames target the same VMC output before Mixer exists | Preserve deterministic source registration order and document Phase 1 semantics. |
| Partial bone data could cause unintended jumps | Omit incomplete VMC Bone Pose messages instead of synthesizing transforms. |
| Relative timestamps could be mistaken for OSC wall-clock time | Require explicit `metadata.clock` for Unix frame timestamps and default Bundle timing to send-time. |
| Large recordings could exhaust memory | Use JSONL and line-by-line read/write throughout. |
| Tauri native code exists in two apps | Share the wire contract and add matching small commands without changing existing BlendShape command behavior. |
