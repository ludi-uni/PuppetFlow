# Official Preset Motion Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tune the six non-Standard official PuppetFlow presets so each has a restrained, recognizable motion personality while preserving Standard, mouth behavior, preset v3 compatibility, and single-owner motion keys.

**Architecture:** Keep `packages/preset/src/build-official-presets.ts` as the only editable source of official preset behavior. Add characterization and contract coverage around the generated JSON, update the six explicit `PRESET_VARIANTS`, regenerate both preset directories, and document the resulting profiles. Do not add a profile abstraction, plugin, Motion Pack, public API, or preset schema change.

**Tech Stack:** TypeScript, PFScript, Vitest, pnpm workspaces, Prettier, ESLint, tsup.

## Global Constraints

- Associate implementation and verification with Plane work item `PUPPETFL-6` (`1d1fb0a5-6995-4214-acb2-95d1e713178a`). It is already in the repository's In Progress state. Before handoff, add a concise summary and verification evidence, then move it to Review—not Done.
- Work only on branch `codex/preset-motion-tuning`.
- Preserve the unrelated untracked paths currently in the worktree: `.codex/`, `.pnpm-store/`, `docs/superpowers/plans/2026-08-08-motion-runtime-phase1.md`, `docs/superpowers/plans/2026-08-08-motion-runtime-phase2.md`, `docs/superpowers/plans/2026-08-08-studio-typescript-errors.md`, `pyproject.toml`, `src/`, and `tests/`.
- Do not edit generated `.pfpreset` files by hand. Change the generator, run `pnpm build:presets`, and commit both generated directories together.
- Do not change `Standard` PFScript, plugin configuration, extension configuration, or Graph gain.
- Do not change any preset's `mouthY` assignment or `mouthX` Graph gain.
- PFScript must not assign `lookX` or `lookY`; the idle plugin owns those keys.
- Thinking PFScript must not assign `headTilt`, `facePitch`, `lookX`, or `lookY`; the Thinking Pack owns them.
- New head/face oscillations must use distinct IDs and frequencies per axis, stay within `0.05` of their declared center, and emit normalized values.
- Real Live2D/VRM appearance is a human acceptance gate and must not be claimed from automated tests.

---

## Task 1: Lock Existing Compatibility Contracts

**Files:**

- Modify: `packages/preset/src/official-presets.test.ts:1-33`

This is characterization coverage for behavior that must survive the tuning. It is expected to pass before production changes.

- [ ] **Step 1: Expand the fixture list to all seven official presets**

Replace the single output-directory constant and six-file list with repository-root-aware constants and a typed seven-preset list:

```ts
import type { PuppetFlowPreset } from "./types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PACKAGE_PRESETS_DIR = join(ROOT, "packages/behavior-packs/presets");
const ROOT_PRESETS_DIR = join(ROOT, "presets");

const OFFICIAL_PRESETS = [
  "Standard",
  "Curious",
  "Happy",
  "Idle",
  "Thinking",
  "Sleepy",
  "Focused",
] as const;

type OfficialPresetName = (typeof OFFICIAL_PRESETS)[number];

function readPreset(directory: string, name: OfficialPresetName): PuppetFlowPreset {
  return JSON.parse(
    readFileSync(join(directory, `${name}.pfpreset`), "utf8"),
  ) as PuppetFlowPreset;
}

function graphGain(preset: PuppetFlowPreset): unknown {
  return preset.graph.nodes.find((node) => node.id === "multiply")?.data.gain;
}
```

Update the existing load/overlap loop to derive `${name}.pfpreset` and load from `PACKAGE_PRESETS_DIR`.

- [ ] **Step 2: Add an exact Standard baseline test**

Add constants and a test that pin the source-level Standard contract:

```ts
const STANDARD_PFSCRIPT = `-- 体の揺れ
bodyLean = oscillator(id = "body", frequency = (0.3 * interest) + 0.1) * 0.1 * clamp(interest, 0.3, 1) + 0.5
bodyRoll = oscillator(id = "body", frequency = (0.3 * interest) + 0.1) * 0.1 * clamp(interest, 0.3, 1) + 0.5

-- 興味の度合いで前のめり
bodyYaw = interest * -0.3 + 0.5

-- RMSで口の開き
mouthY = volume

-- 疲れると眠そうに
eyeYaw = clamp(energy, 0.4, 1)

-- 呼吸
breath = breath(0.1)`;

const STANDARD_PLUGINS = [
  {
    id: "blink",
    config: {
      minInterval: 3,
      maxInterval: 8,
      closeDuration: 0.12,
      blinkStrength: 1,
    },
  },
  { id: "idle", config: { interestThreshold: 0.35, wanderBoost: 0.12 } },
];

it("keeps Standard as the exact neutral baseline", () => {
  const preset = readPreset(PACKAGE_PRESETS_DIR, "Standard");

  expect(preset.behaviorPfScript).toBe(STANDARD_PFSCRIPT);
  expect(preset.behaviorPlugins).toEqual(STANDARD_PLUGINS);
  expect(preset.extensions).toEqual({ packs: [] });
  expect(graphGain(preset)).toBe(0.5);
});
```

- [ ] **Step 3: Pin mouth formulas and Graph gains for every preset**

Add exact expectations and assert against source text rather than compiled AST formatting:

```ts
const MOUTH_CONTRACT: Record<
  OfficialPresetName,
  { mouthY: string; mouthXGain: number }
> = {
  Standard: { mouthY: "mouthY = volume", mouthXGain: 0.5 },
  Curious: { mouthY: "mouthY = volume", mouthXGain: 0.5 },
  Happy: { mouthY: "mouthY = volume", mouthXGain: 0.8 },
  Idle: { mouthY: "mouthY = volume", mouthXGain: 0.4 },
  Thinking: { mouthY: "mouthY = volume", mouthXGain: 0.35 },
  Sleepy: { mouthY: "mouthY = volume * 0.85", mouthXGain: 0.3 },
  Focused: { mouthY: "mouthY = volume", mouthXGain: 0.35 },
};

it.each(OFFICIAL_PRESETS)("preserves %s mouth behavior", (name) => {
  const preset = readPreset(PACKAGE_PRESETS_DIR, name);
  const contract = MOUTH_CONTRACT[name];
  const mouthLines = preset.behaviorPfScript
    ?.split("\n")
    .filter((line) => line.trimStart().startsWith("mouthY ="));

  expect(mouthLines).toEqual([contract.mouthY]);
  expect(graphGain(preset)).toBe(contract.mouthXGain);
});
```

- [ ] **Step 4: Assert byte-identical generated mirrors**

```ts
it.each(OFFICIAL_PRESETS)("keeps both generated copies of %s identical", (name) => {
  const filename = `${name}.pfpreset`;
  expect(readFileSync(join(PACKAGE_PRESETS_DIR, filename), "utf8")).toBe(
    readFileSync(join(ROOT_PRESETS_DIR, filename), "utf8"),
  );
});
```

- [ ] **Step 5: Run the focused characterization tests**

Run:

```powershell
pnpm exec vitest run packages/preset/src/official-presets.test.ts
```

Expected: PASS. All seven presets load without overlap warnings; Standard, mouth, and mirror contracts pass before tuning.

- [ ] **Step 6: Format and commit the safety tests**

Run:

```powershell
pnpm exec prettier --check packages/preset/src/official-presets.test.ts
git diff --check
git status --short
git add packages/preset/src/official-presets.test.ts
git diff --cached --check
git commit -m "test: lock official preset compatibility"
```

Expected: only `packages/preset/src/official-presets.test.ts` is staged and committed; unrelated untracked paths remain untouched.

---

## Task 2: Specify and Implement the Six Motion Personalities

**Files:**

- Modify: `packages/preset/src/official-presets.test.ts:12-end`
- Modify: `packages/preset/src/build-official-presets.ts:75-180`
- Regenerate: `packages/behavior-packs/presets/Curious.pfpreset`
- Regenerate: `packages/behavior-packs/presets/Happy.pfpreset`
- Regenerate: `packages/behavior-packs/presets/Idle.pfpreset`
- Regenerate: `packages/behavior-packs/presets/Thinking.pfpreset`
- Regenerate: `packages/behavior-packs/presets/Sleepy.pfpreset`
- Regenerate: `packages/behavior-packs/presets/Focused.pfpreset`
- Regenerate: `presets/Curious.pfpreset`
- Regenerate: `presets/Happy.pfpreset`
- Regenerate: `presets/Idle.pfpreset`
- Regenerate: `presets/Thinking.pfpreset`
- Regenerate: `presets/Sleepy.pfpreset`
- Regenerate: `presets/Focused.pfpreset`

`Standard.pfpreset` is regenerated by the command but must have no diff.

- [ ] **Step 1: Add assignment-key and plugin lookup helpers**

Add these helpers to the test file:

```ts
function assignedKeys(preset: PuppetFlowPreset): string[] {
  return Array.from(
    preset.behaviorPfScript?.matchAll(/^([A-Za-z][A-Za-z0-9]*)\s*=/gm) ?? [],
    (match) => match[1],
  );
}

function pluginConfig(preset: PuppetFlowPreset, id: string): unknown {
  return preset.behaviorPlugins?.find((plugin) => plugin.id === id)?.config;
}
```

- [ ] **Step 2: Write failing personality-contract tests**

Add a single table-driven test with exact expected ownership and configuration:

```ts
const PERSONALITY_CONTRACT = {
  Curious: {
    addedKeys: ["faceYaw", "headTilt"],
    blink: {
      minInterval: 3,
      maxInterval: 8,
      closeDuration: 0.12,
      blinkStrength: 1,
    },
    idle: { interestThreshold: 0.5, wanderBoost: 0.1 },
  },
  Happy: {
    addedKeys: ["facePitch", "headTilt"],
    blink: {
      minInterval: 2.8,
      maxInterval: 7,
      closeDuration: 0.11,
      blinkStrength: 1,
    },
    idle: { interestThreshold: 0.3, wanderBoost: 0.08 },
  },
  Idle: {
    addedKeys: ["faceYaw", "headTilt"],
    blink: {
      minInterval: 3.5,
      maxInterval: 8.5,
      closeDuration: 0.13,
      blinkStrength: 1,
    },
    idle: { interestThreshold: 0.5, wanderBoost: 0.07 },
  },
  Thinking: {
    addedKeys: [],
    blink: {
      minInterval: 3,
      maxInterval: 8,
      closeDuration: 0.12,
      blinkStrength: 1,
    },
    idle: { interestThreshold: 0.4, wanderBoost: 0.06 },
  },
  Sleepy: {
    addedKeys: ["facePitch", "headTilt"],
    blink: {
      minInterval: 4,
      maxInterval: 10,
      closeDuration: 0.18,
      blinkStrength: 1,
    },
    idle: { interestThreshold: 0.5, wanderBoost: 0.05 },
  },
  Focused: {
    addedKeys: ["facePitch", "headTilt"],
    blink: {
      minInterval: 3,
      maxInterval: 8,
      closeDuration: 0.12,
      blinkStrength: 1,
    },
    idle: { interestThreshold: 0.3, wanderBoost: 0.03 },
  },
} as const;

it.each(Object.entries(PERSONALITY_CONTRACT))(
  "gives %s its approved motion ownership and plugin profile",
  (name, contract) => {
    const preset = readPreset(
      PACKAGE_PRESETS_DIR,
      name as keyof typeof PERSONALITY_CONTRACT,
    );
    const keys = assignedKeys(preset);

    for (const key of contract.addedKeys) expect(keys).toContain(key);
    expect(keys).not.toContain("lookX");
    expect(keys).not.toContain("lookY");
    expect(pluginConfig(preset, "blink")).toEqual(contract.blink);
    expect(pluginConfig(preset, "idle")).toEqual(contract.idle);
  },
);

it("leaves Thinking head and face pose ownership to the Thinking Pack", () => {
  const preset = readPreset(PACKAGE_PRESETS_DIR, "Thinking");
  const keys = assignedKeys(preset);

  expect(keys).not.toContain("headTilt");
  expect(keys).not.toContain("facePitch");
  expect(preset.extensions).toEqual({
    packs: [{ id: "thinking", config: { intensity: 0.5 } }],
  });
});
```

Also add exact source-fragment assertions for the new center/amplitude bounds so a future edit cannot silently exceed the approved first-pass values:

```ts
const MOTION_SOURCE_CONTRACT = {
  Curious: [
    'faceYaw = oscillator(id = "curious-face-yaw", frequency = 0.12) * 0.045 + 0.5',
    'headTilt = oscillator(id = "curious-head-tilt", frequency = 0.17) * 0.035 + 0.5',
  ],
  Happy: [
    'facePitch = oscillator(id = "happy-face-pitch", frequency = 0.42) * 0.025 + 0.5',
    'headTilt = oscillator(id = "happy-head-tilt", frequency = 0.31) * 0.02 + 0.5',
  ],
  Idle: [
    'faceYaw = oscillator(id = "idle-face-yaw", frequency = 0.07) * 0.015 + 0.5',
    'headTilt = oscillator(id = "idle-head-tilt", frequency = 0.05) * 0.01 + 0.5',
  ],
  Sleepy: [
    'facePitch = oscillator(id = "sleepy-face-pitch", frequency = 0.06) * 0.01 + 0.47',
    'headTilt = oscillator(id = "sleepy-head-tilt", frequency = 0.05) * 0.015 + 0.5',
  ],
  Focused: [
    'facePitch = oscillator(id = "focused-face-pitch", frequency = 0.12) * 0.008 + 0.48',
    'headTilt = oscillator(id = "focused-head-tilt", frequency = 0.09) * 0.008 + 0.5',
  ],
} as const;

it.each(Object.entries(MOTION_SOURCE_CONTRACT))(
  "keeps %s head and face motion within the approved first-pass bounds",
  (name, expectedLines) => {
    const source = readPreset(
      PACKAGE_PRESETS_DIR,
      name as keyof typeof MOTION_SOURCE_CONTRACT,
    ).behaviorPfScript;

    for (const line of expectedLines) expect(source).toContain(line);
  },
);
```

- [ ] **Step 3: Run the focused test and confirm the RED state**

Run:

```powershell
pnpm exec vitest run packages/preset/src/official-presets.test.ts
```

Expected: FAIL because current generated presets lack the new head/face assignments, retain old idle settings, and Thinking still assigns `headTilt` at Pack intensity `0.65`. Confirm failures are limited to the newly added personality contracts before editing production code.

- [ ] **Step 4: Tune Curious, Happy, and Idle in the generator**

Replace only those variants' PFScript and plugin arrays with the following exact motion values. Preserve their existing `bodyYaw`, `mouthY`, `eyeYaw`, `breath`, `mouthGain`, and empty extension packs.

```ts
// Curious assignments
bodyLean =
  oscillator((id = "curious-body-lean"), (frequency = 0.28 * interest + 0.08)) *
    0.075 *
    clamp(interest, 0.3, 1) +
  0.5;
bodyRoll =
  oscillator((id = "curious-body-roll"), (frequency = 0.22 * interest + 0.07)) *
    0.06 *
    clamp(interest, 0.3, 1) +
  0.5;
faceYaw = oscillator((id = "curious-face-yaw"), (frequency = 0.12)) * 0.045 + 0.5;
headTilt = oscillator((id = "curious-head-tilt"), (frequency = 0.17)) * 0.035 + 0.5;
```

Curious plugins:

```ts
behaviorPlugins: [
  {
    id: "blink",
    config: { minInterval: 3, maxInterval: 8, closeDuration: 0.12, blinkStrength: 1 },
  },
  { id: "idle", config: { interestThreshold: 0.5, wanderBoost: 0.1 } },
],
```

```ts
// Happy assignments
bodyLean =
  oscillator((id = "happy-body-lean"), (frequency = 0.32 * interest + 0.14)) *
    0.09 *
    clamp(interest, 0.2, 1) +
  0.5;
bodyRoll =
  oscillator((id = "happy-body-roll"), (frequency = 0.27 * interest + 0.12)) *
    0.07 *
    clamp(interest, 0.2, 1) +
  0.5;
facePitch = oscillator((id = "happy-face-pitch"), (frequency = 0.42)) * 0.025 + 0.5;
headTilt = oscillator((id = "happy-head-tilt"), (frequency = 0.31)) * 0.02 + 0.5;
```

Happy plugins:

```ts
behaviorPlugins: [
  {
    id: "blink",
    config: { minInterval: 2.8, maxInterval: 7, closeDuration: 0.11, blinkStrength: 1 },
  },
  { id: "idle", config: { interestThreshold: 0.3, wanderBoost: 0.08 } },
],
```

```ts
// Idle assignments
bodyLean =
  oscillator((id = "idle-body-lean"), (frequency = 0.12)) *
    0.04 *
    clamp(interest, 0.2, 1) +
  0.5;
bodyRoll =
  oscillator((id = "idle-body-roll"), (frequency = 0.09)) *
    0.03 *
    clamp(interest, 0.2, 1) +
  0.5;
faceYaw = oscillator((id = "idle-face-yaw"), (frequency = 0.07)) * 0.015 + 0.5;
headTilt = oscillator((id = "idle-head-tilt"), (frequency = 0.05)) * 0.01 + 0.5;
```

Idle plugins:

```ts
behaviorPlugins: [
  {
    id: "blink",
    config: { minInterval: 3.5, maxInterval: 8.5, closeDuration: 0.13, blinkStrength: 1 },
  },
  { id: "idle", config: { interestThreshold: 0.5, wanderBoost: 0.07 } },
],
```

- [ ] **Step 5: Tune Thinking, Sleepy, and Focused in the generator**

Use these exact body/head/face assignments while preserving each preset's existing `bodyYaw`, `mouthY`, `eyeYaw`, `breath`, and `mouthGain`:

```ts
// Thinking assignments; no PFScript headTilt, facePitch, lookX, or lookY
bodyLean = oscillator((id = "thinking-body-lean"), (frequency = 0.15)) * 0.04 + 0.5;
bodyRoll = oscillator((id = "thinking-body-roll"), (frequency = 0.11)) * 0.03 + 0.5;
```

Thinking plugins and pack:

```ts
behaviorPlugins: [
  {
    id: "blink",
    config: { minInterval: 3, maxInterval: 8, closeDuration: 0.12, blinkStrength: 1 },
  },
  { id: "idle", config: { interestThreshold: 0.4, wanderBoost: 0.06 } },
],
extensions: { packs: [{ id: "thinking", config: { intensity: 0.5 } }] },
```

```ts
// Sleepy assignments
bodyLean =
  oscillator((id = "sleepy-body-lean"), (frequency = 0.1)) *
    0.035 *
    clamp(energy, 0.2, 1) +
  0.5;
bodyRoll = oscillator((id = "sleepy-body-roll"), (frequency = 0.07)) * 0.025 + 0.5;
facePitch = oscillator((id = "sleepy-face-pitch"), (frequency = 0.06)) * 0.01 + 0.47;
headTilt = oscillator((id = "sleepy-head-tilt"), (frequency = 0.05)) * 0.015 + 0.5;
```

Sleepy plugins:

```ts
behaviorPlugins: [
  {
    id: "blink",
    config: { minInterval: 4, maxInterval: 10, closeDuration: 0.18, blinkStrength: 1 },
  },
  { id: "idle", config: { interestThreshold: 0.5, wanderBoost: 0.05 } },
],
```

```ts
// Focused assignments
bodyLean =
  oscillator((id = "focused-body-lean"), (frequency = 0.22 * interest + 0.08)) *
    0.035 *
    clamp(interest, 0.4, 1) +
  0.5;
bodyRoll =
  oscillator((id = "focused-body-roll"), (frequency = 0.18 * interest + 0.07)) *
    0.025 *
    clamp(interest, 0.4, 1) +
  0.5;
facePitch = oscillator((id = "focused-face-pitch"), (frequency = 0.12)) * 0.008 + 0.48;
headTilt = oscillator((id = "focused-head-tilt"), (frequency = 0.09)) * 0.008 + 0.5;
```

Focused plugins:

```ts
behaviorPlugins: [
  {
    id: "blink",
    config: { minInterval: 3, maxInterval: 8, closeDuration: 0.12, blinkStrength: 1 },
  },
  { id: "idle", config: { interestThreshold: 0.3, wanderBoost: 0.03 } },
],
```

- [ ] **Step 6: Regenerate both preset directories**

Run:

```powershell
pnpm build:presets
```

Expected: generator reports seven presets written to both output directories. `Standard.pfpreset` has no diff; the other six files change identically in both directories.

- [ ] **Step 7: Run the focused tests and inspect ownership**

Run:

```powershell
pnpm exec vitest run packages/preset/src/official-presets.test.ts
git diff -- packages/preset/src/build-official-presets.ts packages/preset/src/official-presets.test.ts packages/behavior-packs/presets presets
git diff --exit-code -- packages/behavior-packs/presets/Standard.pfpreset presets/Standard.pfpreset
```

Expected: tests PASS; the final command exits 0; no PFScript adds `lookX`/`lookY`; Thinking removes PFScript `headTilt`; both copies of each non-Standard preset show the same generated changes.

- [ ] **Step 8: Format, stage the exact scope, and commit**

Run:

```powershell
pnpm exec prettier --write packages/preset/src/build-official-presets.ts packages/preset/src/official-presets.test.ts
pnpm exec prettier --check packages/preset/src/build-official-presets.ts packages/preset/src/official-presets.test.ts packages/behavior-packs/presets/*.pfpreset presets/*.pfpreset
git diff --check
git add packages/preset/src/build-official-presets.ts packages/preset/src/official-presets.test.ts packages/behavior-packs/presets presets
git diff --cached --check
git diff --cached --stat
git commit -m "feat: tune official preset motions"
```

Expected: the commit contains the generator, contract tests, and regenerated preset mirrors only. If formatting changes generated JSON, rerun the focused test and mirror comparison before committing.

---

## Task 3: Document the Tuned Profiles and Ownership

**Files:**

- Modify: `docs/reference/presets.md:5-18`
- Modify: `docs/reference/presets.md:72-91`

- [ ] **Step 1: Update the layer-ownership examples**

In the PFScript row, mention that non-Standard profiles may own restrained `faceYaw`, `facePitch`, and `headTilt`. Keep `lookX`/`lookY` assigned to the idle plugin and document that Thinking delegates its head/face pose to the Thinking Pack.

- [ ] **Step 2: Replace the short preset descriptions with observable distinctions**

Update the official-preset table to communicate these outcomes without exposing every implementation constant:

```md
| **Standard** | 変更しない中立基準（PFScript + blink/idle + Graph mouthX） |
| Curious | ゆっくりした顔の左右振りと独立した首傾げ、小さく頻度高めの視線移動 |
| Happy | 軽快だが抑えた体の揺れ、短い上下顔向きと首傾げ、やや速いまばたき |
| Idle | 小さくゆっくりした体・顔・首の揺れと、頻度高めで小幅な待機視線 |
| Thinking | 控えめな体の揺れと Thinking Pack 単独所有の思考ポーズ |
| Sleepy | やや伏し目の顔向き、非常に遅い首傾げ、半開き目と長めのまばたき |
| Focused | 前寄りで安定した顔向き、最小限の首傾げと視線 wander |
```

Add one sentence below the table stating that mouth formulas and smile Graph gains retain their established per-preset behavior.

- [ ] **Step 3: Format and review the documentation diff**

Run:

```powershell
pnpm exec prettier --write docs/reference/presets.md
pnpm exec prettier --check docs/reference/presets.md
git diff --check
git diff -- docs/reference/presets.md
```

Expected: PASS. Documentation matches the approved design and does not promise model-independent visual equivalence.

- [ ] **Step 4: Commit the documentation**

Run:

```powershell
git add docs/reference/presets.md
git diff --cached --check
git commit -m "docs: describe tuned preset motions"
```

Expected: only `docs/reference/presets.md` is committed.

---

## Task 4: Run Completion Verification and Hand Off for Visual Review

**Files:**

- Verify: `packages/preset/src/build-official-presets.ts`
- Verify: `packages/preset/src/official-presets.test.ts`
- Verify: `packages/behavior-packs/presets/*.pfpreset`
- Verify: `presets/*.pfpreset`
- Verify: `docs/reference/presets.md`
- Update externally: Plane `PUPPETFL-6`

- [ ] **Step 1: Re-run focused and package-level checks**

Run in this order:

```powershell
pnpm exec vitest run packages/preset/src/official-presets.test.ts
pnpm --filter @puppetflow/preset test
pnpm --filter @puppetflow/preset build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run repository-wide static and build checks**

Run:

```powershell
pnpm lint
pnpm format:check
pnpm build
```

Expected: all commands exit 0. If an unrelated pre-existing failure appears, isolate it, record exact evidence, and do not silently broaden scope.

- [ ] **Step 3: Run the full suite**

Run:

```powershell
pnpm test
```

Expected: exit 0.

- [ ] **Step 4: Prove deterministic generation and mirror cleanliness**

Run:

```powershell
pnpm build:presets
git diff --exit-code -- packages/behavior-packs/presets presets
git diff --check
```

Expected: all commands exit 0; regeneration creates no diff and both mirrors remain byte-identical through the contract tests.

- [ ] **Step 5: Review final scope and repository status**

Run:

```powershell
git status --short --branch
git diff main...HEAD --stat
git diff main...HEAD -- packages/preset/src/build-official-presets.ts packages/preset/src/official-presets.test.ts docs/reference/presets.md
```

Expected: only the approved design/plan, generator, test, documentation, and generated preset changes appear in branch history. Unrelated untracked paths remain unmodified and unstaged. Confirm no secret or environment-specific path appears in the diff.

- [ ] **Step 6: Synchronize Plane and request human visual validation**

Add a concise PUPPETFL-6 comment containing changed behavior, exact verification commands/results, and the explicit limitation that Live2D/VRM visual quality is untested. Move PUPPETFL-6 to the existing Review state (`bac29402-803d-46fd-a171-35111b2b7773`), not Done.

Handoff should ask the user to compare all seven presets on a representative model. If the six tuned profiles are too subtle, create a separately reviewed second-pass plan rather than increasing amplitudes within this task.
