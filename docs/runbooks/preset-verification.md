# PuppetFlow Preset Verification Runbook

Use this runbook only when a change affects preset source, schema, serialization, loading, materialization, or generation. Typical paths and components include:

- `packages/preset/**`
- `packages/behavior-packs/presets/**`
- `presets/**`
- `loadPreset`, preset parsing, or preset serialization
- `behaviorPfScript`, `materializePresetBehavior`, or the official preset generator

## Canonical paths

- Official generator: `packages/preset/src/build-official-presets.ts`
- Canonical generated presets: `packages/behavior-packs/presets/*.pfpreset`
- Root mirror: `presets/*.pfpreset`
- Focused official-preset coverage: `packages/preset/src/official-presets.test.ts`
- Parsing and materialization coverage: `packages/preset/src/load-preset.test.ts` and `packages/preset/src/compile-behavior.test.ts`

`behaviorPfScript` is the editable behavior source when present; the `behavior` AST is a materialized cache. See [the preset canonical-model ADR](../adr/preset-canonical-model.md) for the contract.

## Verification sequence

1. Inspect `git status --short` and the preset-related diff before running generators. If the generator or either output tree already contains unrelated user changes, do not run generation until the overlap is resolved.
2. Run the smallest focused preset test that covers the changed contract, for example `pnpm exec vitest run packages/preset/src/official-presets.test.ts` for official preset generation and mirror behavior.
3. When source or generation changes require refreshed outputs and the working tree is safe, run `pnpm build:presets`.
4. Re-run the relevant focused tests and inspect `git diff --stat -- packages/behavior-packs/presets presets` plus the corresponding content diff.
5. Confirm that expected generated files changed, unexpected files did not change, and canonical and mirrored outputs remain internally consistent.

For an intentional generated-output change, do not use `git diff --exit-code` against `HEAD` as a blanket success condition. A nonzero diff is expected in that case. Use a zero-diff check only when the task expects regeneration to produce no tracked changes. Run full `pnpm verify` only when Level 3 verification is independently justified and its generation step cannot overwrite unrelated work.
