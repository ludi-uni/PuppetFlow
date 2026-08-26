# Task 1 Completion Report

## Scope

- Added the optional `StateSourceUpdate` and `PollingStateSource` contracts plus
  `isPollingStateSource` to `@puppetflow/source-core` without changing `StateSource`.
- Added the Runtime-internal `StateSourceScheduler` and focused scheduler tests.
- Did not modify Runtime lifecycle integration or any transport source.

## Files Changed

- `packages/source-core/src/state-source.ts`
- `packages/source-core/src/index.ts`
- `packages/runtime/src/source-scheduler.ts`
- `packages/runtime/src/source-scheduler.test.ts`

## Design Decisions

- The guard requires functional `poll` and `apply` members and a finite, nonnegative
  `pollIntervalMs`; incomplete sources remain legacy `StateSource` instances.
- Each polling source owns an abort controller, generation-tagged loop, in-flight flag,
  and latest-update slot. Completed updates replace older slots, while draining removes
  the slot before synchronous `apply()` in attachment order.
- Stop aborts interval waits and polls, clears slots, awaits loops, and suppresses
  late completions by generation/current-state checks. Empty polls still wait their
  configured interval, preventing event-buffer busy loops.
- Poll and apply errors are reported through `onError` and do not prevent other sources
  or later polls from progressing.

## TDD and Verification

- RED: `pnpm exec vitest run packages/runtime/src/source-scheduler.test.ts --reporter=verbose`
  failed as expected because `./source-scheduler.js` did not exist.
- GREEN: the focused scheduler suite passed with 7 tests.
- `pnpm --filter @puppetflow/source-core build` passed.
- `pnpm --filter @puppetflow/runtime build` passed.
- `pnpm exec eslint packages/source-core/src packages/runtime/src/source-scheduler.ts` passed.
- `pnpm exec prettier --check --end-of-line auto packages/source-core/src/state-source.ts packages/source-core/src/index.ts packages/runtime/src/source-scheduler.ts packages/runtime/src/source-scheduler.test.ts` passed.
- `git diff --check` passed.

## Limitations

- Runtime lifecycle/tick draining and built-in HTTP, WebSocket, and MQTT adoption are
  intentionally deferred to Tasks 2 through 4.

## Fix-loop: Per-source Draining

- Review identified that global `drain(target)` can only apply all polling sources before
  the Runtime's legacy-source loop, which cannot preserve a mixed attachment order.
- Added the internal `drainSource(source, target)` operation. It locates the selected
  polling slot and delegates to the same private drain helper as `drain(target)`, so the
  slot is cleared before synchronous `apply()` and error isolation remains identical.
- RED: the new focused test failed with `scheduler.drainSource is not a function`.
- GREEN: focused scheduler coverage passed with 8 tests, including selection and
  one-time slot consumption. The existing Runtime regression suite also passed with
  47 tests; expected error-path `console.error` output was emitted by existing tests.
- Fix-loop checks passed: Runtime declaration build, scoped ESLint, scoped Prettier,
  and `git diff --check`.
