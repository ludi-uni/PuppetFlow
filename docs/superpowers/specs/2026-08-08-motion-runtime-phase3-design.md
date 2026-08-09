# PuppetFlow Motion Runtime Phase 3 Design

**Date:** 2026-08-08
**Status:** Implemented and verified
**Scope:** Fail-safe behavior and a structured Runtime Inspector for the canonical motion path.

## Goal

Add operational safety and observability to the Phase 1/2 canonical motion path without changing existing `MotionSource`, `MotionFrameAdapter`, `Adapter`, PFScript, CLI, or VMC behavior when the new features are not configured.

## Non-goals

- YAML or CLI configuration wiring.
- HTTP, WebSocket, GUI, or Observatory MCP transport.
- VMC protocol validation or live UDP interoperability tests.
- Automatic calibration, One Euro filtering, or Motion Graph/Plugin API expansion.
- Replacing the existing `MotionState` pipeline.

## Existing context

`PuppetFlowRuntime` stores the latest normalized `MotionFrame` per source and dispatches it on each 60 Hz tick. Phase 2 optionally transforms the ordered inputs through `MotionFramePipeline` before sending one frame to each `MotionFrameAdapter`. The runtime already exposes `onMotionPipelineUpdate()` for structured in-process snapshots, but that snapshot does not contain source health, output telemetry, or mixer ownership.

## Recommended architecture

Keep the operational state in `@puppetflow/runtime` and keep frame math pure:

```text
MotionSource
    |
    v
receipt health + stale decision
    |
    v
Fail-safe frame selection / neutral transition
    |
    v
MotionFramePipeline -- optional inspection --> Mixer ownership
    |
    v
MotionFrameAdapter + output telemetry
    |
    v
MotionInspectorSnapshot
```

### Fail-safe

Add a runtime-level configuration method:

```ts
type MotionFailSafeAction = "hold-last-frame" | "blend-to-neutral" | "disable-source";

interface MotionFailSafeOptions {
  timeoutMs: number;
  action: MotionFailSafeAction;
  transitionMs?: number;
}

runtime.configureMotionFailSafe({
  timeoutMs: 1000,
  action: "blend-to-neutral",
  transitionMs: 500,
});
```

The timeout is measured from local frame receipt, not from a source-provided frame timestamp. A source can be connected but stale, so `connected` and `stale` remain separate inspector fields.

- `hold-last-frame`: continue sending the latest frame and mark the source stale.
- `disable-source`: omit stale source input from the pipeline.
- `blend-to-neutral`: continue sending the source while transitioning numeric values to `0`, positions to `0`, rotations to identity, and scales to `1` over `transitionMs`. Partial transforms and unknown bones remain partial and are never synthesized.

The default is disabled, preserving Phase 2 behavior. A zero transition duration applies the neutral result immediately. Fail-safe decisions are per source but use the one configured action, timeout, and transition policy for the initial implementation. Source start/stop errors remain isolated and are reflected in health state.

### Mixer inspection

Extend the Phase 2 mixer contract additively with optional inspection:

```ts
interface MotionChannelOwner {
  sourceId: string;
  priority: number;
  weight: number;
}

interface MotionMixerInspection {
  bones: Record<string, MotionChannelOwner[]>;
  blendShapes: Record<string, MotionChannelOwner[]>;
  parameters: Record<string, MotionChannelOwner[]>;
}

interface MotionMixer {
  mix(inputs: readonly MotionFrameInput[]): MotionFrame | undefined;
  inspect?(inputs: readonly MotionFrameInput[]): MotionMixerInspection;
}
```

`createMotionMixer()` reports the eligible highest-priority candidates for each component, including all same-priority weighted contributors. A composed pipeline exposes the inspection result through an optional `inspect()` method and applies configured bone mapping to ownership keys. Custom mixers that do not implement inspection remain valid; the Runtime Inspector reports an empty/unknown mixer section rather than guessing.

### Runtime Inspector

Expose a synchronous, serializable snapshot:

```ts
interface MotionSourceInspectorSnapshot {
  id: string;
  connected: boolean;
  stale: boolean;
  inputRateHz: number;
  lastFrameAt?: number;
  lastFrameTimestamp?: number;
  ageMs?: number;
}

interface MotionOutputInspectorSnapshot {
  id: string;
  connected: boolean;
  outputRateHz: number;
  lastOutputAt?: number;
  error?: string;
}

interface MotionInspectorSnapshot {
  timestamp: number;
  running: boolean;
  sources: MotionSourceInspectorSnapshot[];
  mixer: MotionMixerInspection | undefined;
  outputs: MotionOutputInspectorSnapshot[];
}
```

`getMotionInspectorSnapshot()` returns defensive arrays/records. Source rates use a bounded recent receipt window. Output rates count successful frame-adapter updates in the same window. Adapter initialize/update/dispose failures are isolated as today and update the output telemetry; legacy `Adapter` outputs are included in the output list only when their existing `update()` path is called.

The existing `onMotionPipelineUpdate()` payload is not changed in this phase. Consumers such as Studio, CLI, or Observatory can subscribe to a future event or poll the snapshot without coupling the Runtime to a transport.

## Compatibility and error handling

- No fail-safe configuration means no filtering, source disabling, or neutralization.
- Existing attachment methods retain their signatures; new configuration and snapshot methods are additive.
- A throwing inspector or custom mixer inspection method cannot stop motion dispatch; inspection is best-effort and returns `undefined` on failure.
- A throwing source, pipeline, or adapter keeps the existing per-component error isolation.
- Stop clears receipt and output telemetry so a subsequent start cannot report stale data from a prior session.

## Testing strategy

1. Unit-test neutral blending and fail-safe action selection with partial bones, numeric channels, quaternion shortest-path behavior, and transition boundaries.
2. Runtime-test stale hold, disable, and blend behavior using synthetic `MotionSource` inputs and a frame adapter; assert legacy behavior remains unchanged when fail-safe is absent.
3. Unit-test mixer inspection for priority, masks, and same-priority contributors; test composed pipeline mapping.
4. Runtime-test source health, input rate, output rate, adapter error, and stop reset in `getMotionInspectorSnapshot()`.
5. Run package tests, Runtime build/type checks where applicable, scoped lint/format, and the full Vitest suite.

## Deferred follow-up

Phase 3 intentionally leaves configuration serialization, transport exposure, richer per-source policies, neutral pose profiles, and automatic source disconnect events for later work. Those additions can consume the additive runtime contracts without changing the canonical `MotionFrame` model.
