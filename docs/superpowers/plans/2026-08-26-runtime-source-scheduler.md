# Runtime State Source Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move built-in State Source I/O out of the Runtime frame tick while preserving
legacy custom StateSource behavior and deterministic latest-update application.

**Architecture:** Add an optional PollingStateSource capability to source-core and a
Runtime-owned StateSourceScheduler. Polling sources perform I/O in one in-flight loop
per source and publish only the newest completed StateSourceUpdate; Runtime drains
those updates synchronously at a tick boundary. Sources without the capability retain
the existing update(target) path.

**Tech Stack:** TypeScript, pnpm workspace, Vitest, tsup, ESLint, Prettier, Fetch,
WebSocket, MQTT

**Spec:** docs/superpowers/specs/2026-08-26-runtime-source-scheduler-design.md

## Global Constraints

- Keep existing StateSource members and signatures unchanged.
- Add PollingStateSource only as an optional capability; no custom source migration.
- poll(signal) must not receive mutable Runtime stores.
- apply(update, target) is synchronous and runs only during Runtime tick draining.
- pollIntervalMs is finite and non-negative; HTTP defaults to 1000 ms.
- One poll may be in flight per source; newest completed update replaces older pending data.
- Polling updates drain in source attachment order before plugin evaluation.
- Runtime stop aborts polling, clears pending updates, and rejects late publications.
- Legacy sources retain their existing awaited update(target) behavior.
- No MotionSource, adapter, YAML/CLI, preset schema, dependency, or security-policy
  changes are in scope.
- Tests use no live network or hardware.

## File Structure

- packages/source-core/src/state-source.ts — optional polling contracts and guard.
- packages/source-core/src/index.ts — public exports for the contracts and guard.
- packages/runtime/src/source-scheduler.ts — loops, slots, cancellation, errors.
- packages/runtime/src/source-scheduler.test.ts — deterministic scheduler tests.
- packages/runtime/src/runtime.ts — scheduler lifecycle and tick drain integration.
- packages/runtime/src/runtime.test.ts — Runtime integration and legacy regression tests.
- packages/source-http/src/http-source.ts and test — fetch/apply split.
- packages/source-websocket/src/websocket-source.ts and test — buffered polling.
- packages/source-mqtt/src/mqtt-source.ts and test — buffered polling.
- docs/reference/sources.md — public lifecycle and compatibility documentation.

---

### Task 1: Add the Polling Contract and Scheduler

**Files:**

- Modify: packages/source-core/src/state-source.ts
- Modify: packages/source-core/src/index.ts
- Create: packages/runtime/src/source-scheduler.ts
- Create: packages/runtime/src/source-scheduler.test.ts

**Interfaces:**

- Consumes: StateSource, SourceUpdateTarget, AbortSignal.
- Produces: StateSourceUpdate, PollingStateSource, isPollingStateSource, and the
  internal StateSourceScheduler used by Task 2.

The source-core contract is:

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

export function isPollingStateSource(source: StateSource): source is PollingStateSource;
```

The scheduler API is internal to Runtime:

```ts
export interface StateSourceSchedulerOptions {
  onError?: (source: PollingStateSource, error: unknown) => void;
}

export class StateSourceScheduler {
  constructor(options?: StateSourceSchedulerOptions);
  start(sources: readonly StateSource[]): void;
  drain(target: SourceUpdateTarget): void;
  stop(): Promise<void>;
}
```

- [ ] **Step 1: Write scheduler RED tests**

Use deferred promises and fake timers. Cover newest-update replacement, one in-flight
poll, stop cancellation and late-result rejection, source-order draining, and poll/apply
error isolation. Each test asserts a real apply(update, target) result.

Run:

```powershell
pnpm exec vitest run packages/runtime/src/source-scheduler.test.ts --reporter=verbose
```

Expected: the file fails because the polling contract and scheduler are absent.

- [ ] **Step 2: Add source-core types and capability guard**

Implement the exact interfaces above without changing StateSource. The guard checks
function members and rejects non-finite or negative pollIntervalMs. Export the types and
guard from source-core/src/index.ts.

```powershell
pnpm --filter @puppetflow/source-core build
```

Expected: the source-core declaration build exits 0 and includes the new public types.

- [ ] **Step 3: Implement the scheduler minimally**

Create one controller, generation value, loop promise, in-flight state, and latest slot
per polling source. A loop calls poll(signal), publishes only current-generation results,
waits pollIntervalMs, and repeats. drain() removes a slot before apply() in attachment
order. Poll/apply errors call onError and do not stop other sources. stop() is idempotent,
aborts controllers, awaits loops, and clears slots.

```powershell
pnpm exec vitest run packages/runtime/src/source-scheduler.test.ts --reporter=verbose
```

Expected: all scheduler tests pass.

- [ ] **Step 4: Build, lint, format, and commit Task 1**

```powershell
pnpm --filter @puppetflow/source-core build
pnpm --filter @puppetflow/runtime build
pnpm exec eslint packages/source-core/src packages/runtime/src/source-scheduler.ts
pnpm exec prettier --check --end-of-line auto packages/source-core/src/state-source.ts packages/source-core/src/index.ts packages/runtime/src/source-scheduler.ts packages/runtime/src/source-scheduler.test.ts
git add packages/source-core/src/state-source.ts packages/source-core/src/index.ts packages/runtime/src/source-scheduler.ts packages/runtime/src/source-scheduler.test.ts
git commit -m "feat(runtime): add polling source scheduler"
```

Expected: checks exit 0 and the commit contains only the four Task 1 files.

---

### Task 2: Integrate Scheduler Lifecycle into Runtime

**Files:**

- Modify: packages/runtime/src/runtime.ts
- Test: packages/runtime/src/runtime.test.ts

**Interfaces:**

- Consumes: StateSourceScheduler, isPollingStateSource, and existing Runtime source
  lifecycle.
- Produces: a tick that drains polling updates synchronously and awaits only legacy
  StateSource.update(target) calls.

- [ ] **Step 1: Write Runtime RED tests**

Add deferred polling fixtures covering: delayed polling does not delay the first tick;
the newest update is visible to behavior exactly once; two polling sources drain in
attachment order; stop aborts polling and ignores late results; and a legacy source
still applies awaited updates before behavior.

```powershell
pnpm exec vitest run packages/runtime/src/runtime.test.ts --reporter=verbose
```

Expected: the new tests fail because Runtime has no scheduler.

- [ ] **Step 2: Add scheduler ownership and target factory**

Instantiate one scheduler in PuppetFlowRuntime. Extract the source target object into
private getSourceUpdateTarget(): SourceUpdateTarget so scheduler drain and legacy updates
share stores and the micro-behavior bridge.

- [ ] **Step 3: Wire start, tick, and stop**

Keep initializeSources() unchanged. After running becomes true, start the scheduler
before the first tick. At tick start, drain polling updates. Skip update() for sources
recognized by isPollingStateSource; await it for all other sources. Stop and await the
scheduler before disposeSources() in normal, already-stopped, and timeout paths. Route
scheduler errors through the existing source log format.

- [ ] **Step 4: Run GREEN checks and commit Task 2**

```powershell
pnpm exec vitest run packages/runtime/src/runtime.test.ts packages/runtime/src/source-scheduler.test.ts --reporter=verbose
pnpm --filter @puppetflow/runtime build
git add packages/runtime/src/runtime.ts packages/runtime/src/runtime.test.ts
git commit -m "feat(runtime): drain polling sources at tick boundaries"
```

Expected: focused tests and the Runtime declaration build pass.

---

### Task 3: Convert HTTP Source

**Files:**

- Modify: packages/source-http/src/http-source.ts
- Test: packages/source-http/src/http-source.test.ts

**Interfaces:**

- Consumes: PollingStateSource, StateSourceUpdate, applyInputPayload, HttpSourceConfig.
- Produces: pollIntervalMs, poll(signal), apply(update, target), and compatible
  update(target).

- [ ] **Step 1: Write HTTP RED tests**

Test that poll() returns JSON without mutating a target, apply() maps the returned
payload, an aborted signal resolves without publication, and non-OK responses reject.

```powershell
pnpm exec vitest run packages/source-http/src/http-source.test.ts --reporter=verbose
```

Expected: new tests fail because poll() and apply() are absent.

- [ ] **Step 2: Split fetch from apply**

Set pollIntervalMs to configured intervalMs or 1000. poll() performs fetch and JSON
parsing and returns { payload, fieldMapping }; it never receives a target. apply() calls
applyInputPayload. Keep direct update(target) interval, error, and abort semantics via
shared private fetch logic. dispose() aborts direct and polling requests.

- [ ] **Step 3: Run HTTP/Runtime checks and commit Task 3**

```powershell
pnpm exec vitest run packages/source-http/src/http-source.test.ts packages/runtime/src/runtime.test.ts --reporter=verbose
pnpm --filter @puppetflow/source-http build
pnpm --filter @puppetflow/runtime build
git add packages/source-http/src/http-source.ts packages/source-http/src/http-source.test.ts
git commit -m "feat(source-http): poll outside runtime ticks"
```

Expected: focused tests and both builds pass.

---

### Task 4: Convert WebSocket and MQTT Sources

**Files:**

- Modify: packages/source-websocket/src/websocket-source.ts
- Test: packages/source-websocket/src/websocket-source.test.ts
- Modify: packages/source-mqtt/src/mqtt-source.ts
- Test: packages/source-mqtt/src/mqtt-source.test.ts

**Interfaces:**

- Consumes: Task 1 polling contracts and Task 2 scheduler lifecycle.
- Produces: buffered polling sources with direct-update compatibility.

- [ ] **Step 1: Write WebSocket/MQTT RED tests**

For each source, enqueue a payload through the existing mock transport, assert poll()
returns a StateSourceUpdate and clears pending data, assert apply() updates the target,
and assert malformed input returns no update.

```powershell
pnpm exec vitest run packages/source-websocket/src/websocket-source.test.ts packages/source-mqtt/src/mqtt-source.test.ts --reporter=verbose
```

Expected: new tests fail because polling methods are absent.

- [ ] **Step 2: Implement buffered polling**

Set pollIntervalMs to 16 for both sources. poll() returns and clears the latest pending
payload, or undefined when empty/aborted. apply() calls applyInputPayload with source
mapping. Preserve initialization, malformed-message handling, direct update(target), and
disposal behavior.

- [ ] **Step 3: Run source/Runtime checks and commit Task 4**

```powershell
pnpm exec vitest run packages/source-websocket/src/websocket-source.test.ts packages/source-mqtt/src/mqtt-source.test.ts packages/runtime/src/source-scheduler.test.ts packages/runtime/src/runtime.test.ts --reporter=verbose
pnpm --filter @puppetflow/source-websocket build
pnpm --filter @puppetflow/source-mqtt build
git add packages/source-websocket/src/websocket-source.ts packages/source-websocket/src/websocket-source.test.ts packages/source-mqtt/src/mqtt-source.ts packages/source-mqtt/src/mqtt-source.test.ts
git commit -m "feat(sources): schedule websocket and mqtt polling"
```

Expected: focused tests and both source builds pass.

---

### Task 5: Document and Verify the Complete Path

**Files:**

- Modify: docs/reference/sources.md

**Interfaces:**

- Consumes: completed source-core, scheduler, Runtime, HTTP, WebSocket, and MQTT APIs.
- Produces: accurate public lifecycle and compatibility documentation.

- [ ] **Step 1: Update the source reference**

Document PollingStateSource, background I/O, one in-flight poll, newest-update
replacement, tick-boundary application order, stop cancellation, error isolation, HTTP's
1000 ms interval, WebSocket/MQTT's 16 ms buffer drain, and legacy custom-source
update(target) semantics. Replace the current claim that every update runs inside tick.

- [ ] **Step 2: Run complete verification**

```powershell
pnpm --filter @puppetflow/source-core build
pnpm --filter @puppetflow/runtime build
pnpm --filter @puppetflow/source-http build
pnpm --filter @puppetflow/source-websocket build
pnpm --filter @puppetflow/source-mqtt build
pnpm exec eslint packages/source-core/src packages/runtime/src packages/source-http/src packages/source-websocket/src packages/source-mqtt/src
pnpm exec prettier --check --end-of-line auto packages/source-core/src/state-source.ts packages/source-core/src/index.ts packages/runtime/src/source-scheduler.ts packages/runtime/src/runtime.ts packages/source-http/src/http-source.ts packages/source-websocket/src/websocket-source.ts packages/source-mqtt/src/mqtt-source.ts docs/reference/sources.md
pnpm test
```

Expected: all listed declaration builds, scoped lint/format, and full Vitest exit 0. No live network or hardware test is required. The repository's known test-only strict-tsc diagnostics are not part of this source-runtime gate.

- [ ] **Step 3: Self-review and commit documentation**

Confirm no StateSource member became mandatory, no schema/dependency/security behavior
changed, and only planned files changed. Then run:

```powershell
git add docs/reference/sources.md
git commit -m "docs(sources): describe non-blocking polling lifecycle"
```
