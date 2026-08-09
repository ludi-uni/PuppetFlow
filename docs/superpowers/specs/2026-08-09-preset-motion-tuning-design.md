# Official Preset Motion Tuning Design

**Date:** 2026-08-09

**Plane:** PUPPETFL-6

**Status:** Approved for implementation planning

## Context

PuppetFlow ships seven version 3 presets generated from
`packages/preset/src/build-official-presets.ts`. `Standard` defines the neutral
baseline. The other presets currently differ mostly through body oscillation,
eye openness, blink timing, idle wander, and mouth smile gain. Head and face
motion is sparse, while `Thinking` writes `headTilt` in both PFScript and its
Thinking Motion Pack.

The presets should feel natural and restrained first. If model testing later
shows that the result is too subtle, a separate second pass may increase the
approved amplitudes. This design does not pre-emptively optimize for exaggerated
streaming motion.

## Goals

- Keep `Standard` as the unchanged neutral reference.
- Give the other six presets distinct but restrained head, face, body, blink,
  breath, and idle-wander characteristics.
- Keep every newly introduced oscillation within 0.05 of the normalized 0.5
  neutral value.
- Use different oscillator IDs and frequencies for separate body/head axes so
  that movement does not look mechanically synchronized.
- Preserve the existing preset format, runtime APIs, and layer ownership.
- Keep both generated preset directories byte-for-byte synchronized.

## Non-goals

- Changing `mouthX`, `mouthY`, volume response, or phoneme behavior.
- Changing `Standard` motion, plugin configuration, or Graph gain.
- Adding a new Behavior Plugin, Motion Pack, public API, or preset version.
- Adding model-specific Live2D or VRM parameter mappings.
- Proving subjective visual quality without a real model. Automated checks
  cover structure, ownership, deterministic generation, and regression bounds.

## Canonical Source and Data Flow

The existing generator remains the only editable source of official preset
motion:

```text
packages/preset/src/build-official-presets.ts
  -> pnpm build:presets
  -> packages/behavior-packs/presets/*.pfpreset
  -> presets/*.pfpreset
  -> loadPreset()
  -> PuppetFlowRuntime
```

Generated `.pfpreset` files must not be hand-edited. The implementation changes
the explicit `PRESET_VARIANTS` entries and regenerates both output directories.
No additional configuration abstraction or public profile type is introduced.

## Layer Ownership

| Layer          | Owned motion                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------- |
| PFScript       | Body oscillation, face/head offsets and oscillation, `mouthY`, eye-open baseline, custom breath |
| Graph          | Existing `interest * gain -> mouthX` mapping only                                               |
| `blink` plugin | Blink overlay on `eyeYaw`                                                                       |
| `idle` plugin  | Low-interest `lookX` / `lookY` wander                                                           |
| Thinking Pack  | Thinking-specific `lookX`, `lookY`, `headTilt`, and `facePitch`                                 |

PFScript must not add `lookX` or `lookY`, because the `idle` plugin owns those
keys. Thinking PFScript must stop writing `headTilt`; the Thinking Pack is the
single owner of its thinking pose. The existing intentional `eyeYaw` baseline
plus blink overlay remains unchanged.

## Preset Profiles

All oscillator amplitudes below are applied around normalized neutral 0.5.
Exact oscillator frequencies may be expressed as constants or existing state
expressions, but must preserve the listed amplitude ceilings and use distinct
IDs for independent axes.

| Preset     | PFScript motion                                                                                                                                                                                                                      | Plugin / Pack tuning                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Standard` | No changes                                                                                                                                                                                                                           | No changes                                                                                                                                                            |
| `Curious`  | Reduce body amplitudes to about `0.075` lean and `0.06` roll. Add slow `faceYaw` up to `±0.045` and independently timed `headTilt` up to `±0.035`. Keep existing mouth lines and Graph gain `0.5`.                                   | Keep blink natural. Make idle wander somewhat more frequent, without exceeding the Standard wander amplitude. Target: `interestThreshold 0.5`, `wanderBoost 0.10`.    |
| `Happy`    | Reduce simultaneous body motion to about `0.09` lean and `0.07` roll. Add light `facePitch` up to `±0.025` and `headTilt` up to `±0.02`, using different frequencies. Keep mouth lines and Graph gain `0.8`.                         | Slightly quicker blink cadence with a short close, while reducing idle wander. Target: blink `2.8-7.0 s`, close `0.11 s`; idle threshold `0.3`, boost `0.08`.         |
| `Idle`     | Reduce body amplitudes to about `0.04` lean and `0.03` roll. Add very slow `faceYaw` up to `±0.015` and `headTilt` up to `±0.01`. Keep mouth lines and Graph gain `0.4`.                                                             | Allow low-interest wander more often but at a small amplitude. Target: blink `3.5-8.5 s`, close `0.13 s`; idle threshold `0.5`, boost `0.07`.                         |
| `Thinking` | Reduce body amplitudes to about `0.04` lean and `0.03` roll. Remove PFScript `headTilt`; do not add Pack-owned face or look keys. Keep mouth lines and Graph gain `0.35`.                                                            | Reduce Thinking Pack intensity from `0.65` to `0.5`. Use restrained idle wander (`interestThreshold 0.4`, `wanderBoost 0.06`) and a natural blink cadence.            |
| `Sleepy`   | Reduce body amplitudes to about `0.035` lean and `0.025` roll. Add a restrained `facePitch` centered near `0.47` with at most `±0.01`, plus very slow `headTilt` up to `±0.015`. Keep `mouthY = volume * 0.85` and Graph gain `0.3`. | Preserve the half-open eye baseline and long blink character. Keep a slow `4-10 s` blink with `0.18 s` close and reduce idle wander to threshold `0.5`, boost `0.05`. |
| `Focused`  | Reduce body amplitudes to about `0.035` lean and `0.025` roll. Add a stable `facePitch` centered near `0.48` with at most `±0.008`, and `headTilt` up to `±0.008`. Keep mouth lines and Graph gain `0.35`.                           | Minimize wander (`interestThreshold 0.3`, `wanderBoost 0.03`) and retain a short, natural blink.                                                                      |

These values are first-pass bounds, not a promise of model-independent visual
equivalence. Any stronger second pass must be reviewed separately and must not
silently change mouth behavior.

## Validation Design

`packages/preset/src/official-presets.test.ts` will be expanded into a compact
official-preset contract test. It will verify:

1. All seven presets, including `Standard`, load successfully.
2. No preset reports Graph/PFScript/Behavior Plugin motion overlap warnings.
3. `Standard` retains its exact PFScript source, plugin configuration, and Graph
   gain.
4. Each non-Standard preset contains the approved face/head assignment keys.
5. `Thinking` PFScript does not assign `headTilt`, and its Pack intensity is
   `0.5`.
6. Existing `mouthY` assignment text and per-preset `mouthX` Graph gains remain
   unchanged.
7. Both generated preset directories contain identical files.

The generator already compiles PFScript while building. Invalid syntax or an
invalid preset therefore fails generation or `loadPreset()`; no fallback or
silent default substitution is added.

## Verification Commands

Verification proceeds from narrow to broad:

1. `pnpm build:presets`
2. focused official-preset tests
3. `pnpm --filter @puppetflow/preset build`
4. `pnpm lint`
5. `pnpm build`
6. `pnpm test`
7. `pnpm build:presets` followed by a zero diff for both generated directories

Changed source and documentation files must also pass Prettier directly. A real
Live2D or VRM model review remains a human acceptance step and will determine
whether a later stronger-motion pass is needed.

## Compatibility and Risk

- Preset version stays at 3 and all public APIs remain unchanged.
- Mouth behavior and Standard remain stable, limiting user-visible regression.
- Existing custom model mappings continue to receive normalized 0-1 values.
- New head/face keys may be unmapped on some models; those models simply ignore
  the keys through their existing mapper behavior.
- The highest behavioral risk is additive motion from overlapping layers. The
  ownership rules and overlap tests prevent known conflicts; Thinking explicitly
  removes the current duplicated `headTilt` contribution.

## Acceptance Criteria

- `Standard` is unchanged.
- Curious, Happy, Idle, Thinking, Sleepy, and Focused match the approved profile
  table and remain restrained.
- Mouth formulas and Graph gains are unchanged.
- Thinking has one owner for its thinking head pose.
- Generated preset mirrors are identical.
- Focused, package-level, lint, build, and full-suite verification succeeds.
- Any unperformed model-based visual check is reported explicitly.
