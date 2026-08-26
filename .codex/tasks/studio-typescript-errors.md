# Task State

## Objective

- Eliminate the existing Studio TypeScript errors without changing behavior or dependencies.

## Scope

### Included

- The diagnostics from `apps/studio/tsconfig.json` recorded on 2026-08-08.
- Shared Studio contracts, graph configuration types, pipeline/simple mapping, Scratch/Blockly, and preset/save utility typing.
- Regression validation for the previous Live2D fix.

### Excluded

- Dependency upgrades.
- Broad refactors or public package API changes.
- Unrelated errors outside `apps/studio`.

## Decisions

- Use `apps/studio/node_modules/.bin/tsc.cmd --noEmit -p apps/studio/tsconfig.json --pretty false` as the authoritative typecheck.
- Keep canonical package types strict; narrow values at Studio boundaries instead of weakening shared types.
- Track this scope in Plane work item `Studio TypeScript既存エラーを解消`.

## Files

### Read

- `apps/studio/tsconfig.json`
- All files named by the baseline TypeScript diagnostics.

### Changed

- `apps/studio/src/components/GraphEditor.tsx`
- `apps/studio/src/components/PipelineTab.tsx`
- `apps/studio/src/components/ScratchEditor.tsx`
- `apps/studio/src/components/SimpleGraphMappingEditor.tsx`
- `apps/studio/src/constants/extension-graph-nodes.ts`
- `apps/studio/src/constants/simple-mapping.ts`
- `apps/studio/src/features/shared/StudioChrome.tsx`
- `apps/studio/src/features/shared/StudioTabPanel.tsx`
- `apps/studio/src/hooks/usePresetState.ts`
- `apps/studio/src/scratch/block-definitions.ts`
- `apps/studio/src/scratch/stateful-blocks.ts`
- `apps/studio/src/utils/micro-behavior-draft.ts`
- `apps/studio/src/utils/preset-apply.ts`
- `apps/studio/src/utils/preset-warnings.ts`
- `apps/studio/src/utils/save-text-file.ts`
- Previous Live2D files remain part of the working diff.

## Acceptance criteria

- [x] Studio package-local TypeScript check exits 0.
- [x] Studio tests pass.
- [x] Studio build passes.
- [x] Changed-file lint/format and scoped `git diff --check` pass.
- [ ] No unrelated generated files remain.

## Tests

- Baseline: Studio typecheck failed with the recorded diagnostics.
- Affected utility tests: 4 files / 11 tests passed.
- Studio tests: 25 files / 75 tests passed.
- Studio typecheck and build passed.
- Changed-file ESLint and Prettier passed.
- Strengthened the Live2D regression test; it fails without config synchronization and passes with it restored.

## Open questions

- Full-repository `git diff --check` is blocked by conflict markers in concurrent root-file changes outside this task; those files were intentionally not modified.

## Next action

- Re-run changed-file Prettier, full Vitest, diff checks, and synchronize Plane.
