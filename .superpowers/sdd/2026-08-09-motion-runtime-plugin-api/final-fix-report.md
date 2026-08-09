# Final whole-branch review fixes

## Scope

Implemented only the requested final findings in the motion pipeline, runtime, and motion-frame-graph reference documentation.

## RED

Added regression tests before production changes:

- `pipeline.test.ts`: disabled source filters are not called during `process` or `inspect`; a throwing disabled filter cannot prevent an enabled source from producing output.
- `mixer.test.ts`: invalid policy `priority`/`weight` values are rejected during both `mix` and `inspect`, including disabled sources, empty input, and channel-less frames.
- `runtime.test.ts`: calling `stop()` while already stopped resets graph signals/state before the next `start()`.

Focused RED run with the new tests: 7 failures / 47 existing tests passed. Each failure matched the reported defect.

## GREEN

- `pipeline.ts` filters disabled source inputs before source-filter application for both process and inspect.
- `mixer.ts` validates every policy override eagerly at `mix` and `inspect` entry using finite priority and 0..1 finite weight rules.
- `runtime.ts` centralizes graph reset and invokes it from the already-stopped, timeout, and normal stop paths; the snapshot is refreshed from the controller after reset.
- `motion-frame-graph.md` describes the reset target as configured `initialState` rather than `idle`.

Focused GREEN: 54/54 tests passed.

## Verification

- Affected tests: 3 files, 54/54 passed.
- Both package test sets: 10 files, 74/74 passed.
- `@puppetflow/motion-pipeline` typecheck: passed.
- Both package builds with tsup ESM+DTS: passed.
- ESLint on owned TypeScript files: passed.
- Prettier check on owned files and documentation: passed.
- `git diff --check`: passed.

The runtime package typecheck remains blocked by four existing errors in unrelated test code (`runtime.test.ts` lines 763, 769, 772, and 862); no unrelated files were changed.

## Review notes

No public API, schema, dependency, migration, or security behavior was changed. The existing untracked `.codex/` directory was preserved and not staged.
