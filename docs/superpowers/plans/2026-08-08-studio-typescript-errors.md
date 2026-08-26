# Studio TypeScript Existing Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the existing TypeScript errors reported by `apps/studio/tsconfig.json` without changing product behavior or dependencies.

**Architecture:** Keep the current Studio component and package boundaries. Repair type contracts at their owning definitions, narrow values at UI boundaries, and preserve runtime behavior. Use the Studio package-local TypeScript compiler as the primary gate, followed by Studio tests, build, lint, and formatting.

**Tech Stack:** React, TypeScript strict mode, Vite, Vitest, Blockly, existing PuppetFlow packages.

## Global Constraints

- Scope is limited to the current Studio TypeScript baseline errors.
- Do not upgrade dependencies, change public package APIs, or alter user-facing behavior unless required by the existing type contract.
- Preserve the preceding Live2D fix and its regression test.
- Use direct package-local binaries when the workspace `pnpm` wrapper attempts network installation.

---

### Task 1: Repair shared Studio contracts and graph configuration types

**Files:**

- Modify: `apps/studio/src/features/shared/StudioChrome.tsx`
- Modify: `apps/studio/src/components/GraphEditor.tsx`
- Modify: `apps/studio/src/constants/extension-graph-nodes.ts`
- Test: `apps/studio/src/components/GraphEditor.test.tsx` if an existing graph test needs a type-preserving assertion; otherwise use the package typecheck as the regression test.

**Interfaces:**

- Preserve tab metadata while allowing expert-mode tabs to omit optional descriptions.
- Preserve `PackConfigField` as the canonical config-field shape, including its discriminating `type` field.
- Use React's `ReactNode`/`ReactElement` type instead of the removed global `JSX` namespace.

- [x] **Step 1: Confirm the failing baseline**

Run `apps/studio/node_modules/.bin/tsc.cmd --noEmit -p apps/studio/tsconfig.json --pretty false` and record the errors in the four owned files.

- [x] **Step 2: Apply minimal contract fixes**

Keep the StudioChrome tab prop compatible with the optional descriptions produced by `getTabsForMode`, remove the duplicate `label` spread/property, import the React element type used by GraphEditor, and make graph config-field literals conform to `PackConfigField` rather than weakening the canonical type.

- [x] **Step 3: Re-run the Studio typecheck**

Run the same command and confirm these files no longer appear in the error output.

### Task 2: Repair pipeline, simple mapping, and Scratch/Blockly types

**Files:**

- Modify: `apps/studio/src/components/PipelineTab.tsx`
- Modify: `apps/studio/src/components/ScratchEditor.tsx`
- Modify: `apps/studio/src/components/SimpleGraphMappingEditor.tsx`
- Modify: `apps/studio/src/constants/simple-mapping.ts`
- Modify: `apps/studio/src/scratch/block-definitions.ts`
- Modify: `apps/studio/src/scratch/stateful-blocks.ts`

**Interfaces:**

- Keep `PhonemeInputSource` and the simple mapping key union as the source of truth.
- Treat nullable `MotionState` values as absent before passing them to partial-state consumers.
- Keep Blockly dropdown options as typed two-element `[label, value]` tuples.
- Keep Blockly theme objects compatible with the installed `ITheme` contract, including `name`.

- [x] **Step 1: Add/adjust focused assertions before implementation**

Use the existing Studio tests for simple mapping, pipeline, and Scratch behavior where present; add only a small test if a narrowing changes runtime branching. The failing package typecheck is the required red test for type-only fixes.

- [x] **Step 2: Narrow values at their boundaries**

Use the existing constants/types instead of `string` casts, guard nullable motion state before conversion, annotate dropdown arrays as Blockly menu tuples, and add the required theme metadata.

- [x] **Step 3: Re-run the closest Studio tests and typecheck**

Run the affected test files with Vitest, then the package-local Studio typecheck. Confirm no errors remain in these files.

### Task 3: Repair Studio imports, preset utilities, and browser-global typing

**Files:**

- Modify: `apps/studio/src/features/shared/StudioTabPanel.tsx`
- Modify: `apps/studio/src/hooks/usePresetState.ts`
- Modify: `apps/studio/src/utils/micro-behavior-draft.ts`
- Modify: `apps/studio/src/utils/preset-apply.ts`
- Modify: `apps/studio/src/utils/preset-warnings.ts`
- Modify: `apps/studio/src/utils/save-text-file.ts`
- Modify: the owning `@puppetflow/micro-behavior` export file if the existing type is intentionally public and currently omitted.

**Interfaces:**

- Import `MotionMapperEditorConfig` from the existing mapper-config module.
- Keep `saveTextFile` defined once and preserve its existing export.
- Reuse the existing notification union (`error | success`) rather than introducing a new status.
- Make optional preset source collections safe before indexing or iterating.
- Type the existing browser/test globals through local declarations or existing project augmentation; do not use an unbounded global index signature.

- [x] **Step 1: Confirm each error's owning contract**

Read the referenced imports and declarations, then run the nearest existing utility tests before editing to ensure the baseline behavior is known.

- [x] **Step 2: Apply minimal fixes**

Remove duplicate imports, add missing type imports/exports, map the informational preset message to the existing supported notification path, guard optional sources, and type the browser-only globals without changing save behavior.

- [x] **Step 3: Re-run affected utility tests and typecheck**

Run the affected Vitest files, then the package-local Studio typecheck and confirm none of these files appear in the error output.

### Task 4: Full verification and handoff

**Files:**

- Modify: none unless verification reveals a regression.
- Review: all files changed by Tasks 1–3 and the preceding Live2D fix.

- [x] **Step 1: Run Studio typecheck**

Run `apps/studio/node_modules/.bin/tsc.cmd --noEmit -p apps/studio/tsconfig.json --pretty false`; expected result is exit code 0 with no diagnostics.

- [x] **Step 2: Run Studio tests and build**

Run `node_modules/.bin/vitest.cmd run apps/studio` from the repository root and `apps/studio/node_modules/.bin/vite.cmd build` from `apps/studio`.

- [x] **Step 3: Run lint, format, and scoped diff checks**

Run the repository lint/format checks appropriate to the changed files, then scoped `git diff --check` and inspect `git status --short` for unintended generated files. Full-repository diff checking remains blocked by conflict markers in concurrent root-file changes outside this task.

- [ ] **Step 4: Record verification in Plane**

Add the concise implementation and verification summary to the Plane work item `Studio TypeScript既存エラーを解消`, then move it to the existing Review-equivalent state or the documented started-state fallback.
