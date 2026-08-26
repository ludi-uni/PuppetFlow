# Runtime State Source Scheduler Design

**Date:** 2026-08-26
**Status:** Draft for user review

## Context

`PuppetFlowRuntime.tick()` currently awaits every `StateSource.update()` before
evaluating plugins, behavior, and graph output. `HttpSource.update()` performs a
network fetch with a configurable timeout, so a slow or unavailable endpoint can
delay the motion loop for the duration of that request. WebSocket and MQTT sources
already buffer incoming payloads, but they share the same tick-owned lifecycle.

The existing `StateSource` interface is public and may be implemented by callers.
The fix must remove built-in network waits from the frame-evaluation path without
breaking existing custom sources or changing the Runtime's legacy behavior when a
source does not opt into the new capability.

## Goals

1. Keep network polling and event ingestion outside the 60 Hz frame-evaluation tick.
2. Apply at most the latest completed update from each polling source at a tick
   boundary, in attachment order.
3. Prevent overlapping polls for one source.
4. Abort polling and prevent late results from mutating stores after Runtime stop.
5. Preserve the existing `StateSource.update(target)` contract for legacy/custom
   sources.
6. Cover delayed responses, errors, stop cancellation, ordering, and regression
   behavior with deterministic tests.

## Non-goals

- Behavior HTTP API authentication, CORS, request-size limits, or bind policy.
- Source reconnect/backoff policy beyond the scheduler's cancellation and error
  isolation; that is a separate follow-up.
- A breaking replacement of `StateSource.update()`.
- Changes to MotionSource, canonical frame routing, adapters, or external viewers.
- New dependencies or a package version floor.

## Selected Approach

Add an optional `PollingStateSource` capability in `@puppetflow/source-core` and a
Runtime-owned scheduler in `@puppetflow/runtime`.

Polling sources expose a non-breaking pair of operations:

```ts
export interface StateSourceUpdate {
  readonly payload: unknown;
  readonly fieldMapping?: Readonly<Record<string, string>>;
}

export interface PollingStateSource extends StateSource {
  readonly pollIntervalMs: number;
  poll(signal: AbortSignal): Promise<StateSourceUpdate | undefined>;
  apply(update: StateSourceUpdate, target: SourceUpdateTarget): void;
}
```

`StateSource` itself remains unchanged. Runtime detects a source only as a polling
source when it provides valid `pollIntervalMs`, `poll`, and `apply` members. A
legacy source continues through the existing `update(target)` path, preserving
compatibility for custom implementations.

The scheduler owns one loop and one `AbortController` per polling source. It invokes
`poll()` only after the source's interval has elapsed, never starts a second poll
while the previous one is pending, and stores only the newest completed update. The
source's `poll()` method performs I/O but never receives mutable Runtime stores.

Built-in source behavior:

- HTTP uses `pollIntervalMs = intervalMs`, performs fetch and JSON parsing in
  `poll()`, and applies the payload through `apply()`.
- WebSocket and MQTT use the existing event listeners to buffer payloads; their
  `poll()` returns the newest buffered payload at a short explicit interval, and
  `apply()` performs the existing `applyInputPayload` mapping.
- Existing public `update()` methods remain available for direct callers and tests;
  Runtime uses the polling capability instead of calling them when present.

## Runtime Data Flow

```text
initialize StateSources
        ↓
start polling-source scheduler loops (outside tick)
        ↓
poll → complete update → latest-update slot per source
        ↓
tick starts
        ↓
drain latest slots in attachment order → apply(update, target)
        ↓
plugins → behavior/PFScript → graph → modifiers → extensions → adapters
```

`drain()` is synchronous and runs before `getPluginInput()` in `tick()`. It removes
the selected update from each slot before calling `apply()`, so one update cannot be
applied twice. If several polls complete between ticks, older updates are replaced
by the newest update for that source. Updates from different sources retain the
Runtime's existing attachment order.

The scheduler does not call `apply()` directly from a background loop. This keeps
Store mutation at a frame boundary and avoids interleaving a source update with
behavior or graph evaluation.

## Lifecycle and Error Handling

1. Runtime initializes sources using the existing `initializeSources()` path.
2. After successful initialization, Runtime starts scheduler loops for polling
   sources. Initialization failures remain isolated as today.
3. Each loop catches poll errors, logs them with the source ID, clears the in-flight
   marker, waits for the next interval, and continues. One source cannot stop the
   scheduler or other sources.
4. Runtime stop aborts every polling controller, clears pending slots, and awaits
   loop completion before disposing sources. A generation token is checked before a
   completed poll is published, so a late response from an old run is discarded.
5. Runtime tick no longer awaits polling-source network work. Legacy sources retain
   their current awaited `update()` behavior and are explicitly outside the new
   non-blocking guarantee.

`pollIntervalMs` must be a finite non-negative number. Built-in HTTP retains its
existing default interval of 1000 ms; WebSocket and MQTT use a documented short
interval suitable for draining event buffers. Abort errors during stop are ignored;
other errors are logged and isolated.

## Compatibility

- No existing member is removed or made mandatory.
- Existing custom `StateSource` objects continue to compile and run.
- Runtime's source attachment order and `SourceUpdateTarget` shape remain unchanged.
- Direct calls to built-in `update()` remain supported for existing callers.
- No YAML, CLI, Studio, or preset schema changes are required.

## Testing Strategy

Focused tests will cover:

1. Polling-source capability detection and interval validation.
2. A delayed HTTP poll completing after a tick starts without delaying that tick.
3. At most one in-flight poll per source.
4. Latest-update replacement and attachment-order draining.
5. Poll errors being isolated while later polls continue.
6. Runtime stop aborting pending polls and rejecting late publication.
7. WebSocket and MQTT buffered payloads being applied through the scheduler.
8. Legacy custom `StateSource.update()` behavior remaining unchanged.
9. Existing Runtime, source-core, source-http, source-websocket, and source-mqtt
   tests, followed by package build, full Vitest, lint, and scoped format checks.

The delayed-source tests use injected clocks, deferred promises, or fake timers; no
live network or hardware is required.

## Documentation

Update the source reference to distinguish legacy `StateSource.update()` from the
optional `PollingStateSource` capability. Add a Runtime reference note that polling
results are applied at tick boundaries and that legacy custom sources retain their
existing semantics. The CLI and Studio guides remain unchanged in this phase.

## Deferred Follow-up

After this scheduler work is merged and observed, separately design Behavior HTTP API
authentication/CORS/body limits and source reconnect/backoff. Those changes require
their own security and operational review.
