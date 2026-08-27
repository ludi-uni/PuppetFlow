# Timeline Sources Implementation Plan

> **実行状況:** 完了（2026-08-27）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure `@puppetflow/timeline-sources` workspace package that validates and converts Rhubarb Lip Sync JSON and VOICEVOX AudioQuery JSON into Core `TimelineEvent` values.

**Architecture:** Keep parsing synchronous, stateless, and independent of Runtime, Studio, filesystem, network, audio, and VOICEVOX engine code. Put shared source/error/validation contracts in focused modules, then keep Rhubarb and VOICEVOX timing algorithms in separate adapters that both return ordered `readonly TimelineEvent[]` results. Consumers choose the global-clock placement through `offsetMs` and pass a shallow mutable copy to the current Core `TimelineStore.pushMany` API.

**Tech Stack:** TypeScript 5.8+, ESM workspace packages, `tsup` declarations/build, Vitest, Prettier, pnpm workspace, `@puppetflow/core` `TimelineEvent`.

**Spec:** `docs/superpowers/specs/2026-08-27-timeline-sources-design.md`

## Global Constraints

- The package is pure and synchronous; it performs no Runtime, Studio, HTTP, WebSocket, MQTT, filesystem, audio, or VOICEVOX-engine I/O.
- `TimelineSource<Input>`, `TimelineSourceOptions`, `TimelineSourceParseError`, both parser functions, and both source constants are public exports with generated declarations.
- `offsetMs` defaults to `0`, must be finite and non-negative, and computed boundaries must stay finite and non-negative after the offset is applied.
- Parsers validate the complete input before returning; malformed input throws `TimelineSourceParseError` with source ID and a field path and never returns partial events.
- Parsers never mutate input objects or nested values.
- Every emitted event has finite, non-negative `startMs`/`endMs` with `endMs > startMs`; events are returned in timeline order.
- Rhubarb keeps `A`–`H`/`X` codes as `type: "rhubarb-mouth"` values and never maps them to Japanese phonemes or inserts synthetic Rest gaps.
- VOICEVOX lays out pre-silence, each mora's consonant+vowel duration, pause mora, and post-silence in that order; each duration is divided by positive `speedScale`, boundaries use `Math.round(cursorSeconds * 1000)`, and `sil`/`pau` normalize to `Rest`.
- Do not change Runtime, Studio, Core fields, Preset schemas, timeline reset behavior, or the existing Core `pushMany(events: TimelineEvent[])` signature.
- Use the repository's pinned `pnpm@9.15.9` and run the repository verification commands listed in `AGENTS.md`.

---

### Task 1: Package scaffold and shared source contract

**Files:**

- Create: `packages/timeline-sources/package.json`
- Create: `packages/timeline-sources/tsconfig.json`
- Create: `packages/timeline-sources/src/types.ts`
- Create: `packages/timeline-sources/src/errors.ts`
- Create: `packages/timeline-sources/src/validation.ts`
- Create: `packages/timeline-sources/src/index.ts`
- Test: `packages/timeline-sources/src/types.test.ts`

**Interfaces:**

- Consumes: `TimelineEvent` from `@puppetflow/core`.
- Produces: `TimelineSourceOptions`, `TimelineSource<Input>`, `TimelineSourceParseError`, shared `isRecord`/numeric/path helpers, and a package build/test target for the adapter tasks.

- [ ] **Step 1: Write the failing contract and validation tests**

Create `packages/timeline-sources/src/types.test.ts` with tests for the public shape and common option/error behavior:

```ts
import { describe, expect, it } from "vitest";
import { TimelineSourceParseError } from "./errors.js";
import { isRecord, parseOffsetMs } from "./validation.js";

describe("timeline source contract", () => {
  it("recognizes plain records but not null or arrays", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
  });

  it("defaults offsetMs to zero and accepts finite non-negative values", () => {
    expect(parseOffsetMs("test", undefined)).toBe(0);
    expect(parseOffsetMs("test", { offsetMs: 125.5 })).toBe(125.5);
  });

  it.each([{ offsetMs: -1 }, { offsetMs: Number.NaN }, { offsetMs: Infinity }])(
    "rejects invalid offset %#",
    (options) => {
      expect(() => parseOffsetMs("test", options)).toThrow(TimelineSourceParseError);
    },
  );

  it("keeps source ID, path, name, and message on parse errors", () => {
    const error = new TimelineSourceParseError(
      "test",
      "input.value",
      "must be a number",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("TimelineSourceParseError");
    expect(error.sourceId).toBe("test");
    expect(error.path).toBe("input.value");
    expect(error.message).toContain("input.value");
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm exec vitest run packages/timeline-sources/src/types.test.ts`

Expected: FAIL because the new package files and exports do not exist yet.

- [ ] **Step 3: Add the package metadata and shared implementation**

Create the package metadata using the existing workspace package convention:

```json
{
  "name": "@puppetflow/timeline-sources",
  "version": "0.1.0",
  "license": "Apache-2.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "test": "vitest run --dir ."
  },
  "dependencies": {
    "@puppetflow/core": "workspace:*"
  },
  "devDependencies": {
    "tsup": "^8.5.0"
  }
}
```

Use the repository base TypeScript settings in `packages/timeline-sources/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Define the shared public types in `src/types.ts`:

```ts
import type { TimelineEvent } from "@puppetflow/core";

export interface TimelineSourceOptions {
  readonly offsetMs?: number;
}

export interface TimelineSource<Input = unknown> {
  readonly id: string;
  parse(input: Input, options?: TimelineSourceOptions): readonly TimelineEvent[];
}
```

Define the error with stable fields and a useful message in `src/errors.ts`:

```ts
export class TimelineSourceParseError extends Error {
  readonly sourceId: string;
  readonly path: string;

  constructor(sourceId: string, path: string, reason: string) {
    super(`${sourceId} ${path}: ${reason}`);
    this.name = "TimelineSourceParseError";
    this.sourceId = sourceId;
    this.path = path;
  }
}
```

Implement `src/validation.ts` with these exact side-effect-free helpers (the adapter modules use the returned narrowed values and never mutate them):

```ts
import { TimelineSourceParseError } from "./errors.js";
import type { TimelineSourceOptions } from "./types.js";

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(sourceId: string, path: string, reason: string): never {
  throw new TimelineSourceParseError(sourceId, path, reason);
}

export function requireRecord(
  sourceId: string,
  path: string,
  value: unknown,
): UnknownRecord {
  return isRecord(value) ? value : fail(sourceId, path, "must be an object");
}

export function requireArray(
  sourceId: string,
  path: string,
  value: unknown,
): unknown[] {
  return Array.isArray(value) ? value : fail(sourceId, path, "must be an array");
}

export function requireFiniteNumber(
  sourceId: string,
  path: string,
  value: unknown,
  minimum: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    return fail(sourceId, path, `must be a finite number >= ${minimum}`);
  }
  return value;
}

export function optionalFiniteNumber(
  sourceId: string,
  path: string,
  value: unknown,
  minimum: number,
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return requireFiniteNumber(sourceId, path, value, minimum);
}

export function parseOffsetMs(
  sourceId: string,
  options: TimelineSourceOptions | undefined,
): number {
  const offsetMs = options?.offsetMs;
  return offsetMs === undefined
    ? 0
    : requireFiniteNumber(sourceId, "options.offsetMs", offsetMs, 0);
}

export function addOffset(
  sourceId: string,
  path: string,
  offsetMs: number,
  boundaryMs: number,
): number {
  const result = offsetMs + boundaryMs;
  return Number.isFinite(result) && result >= 0
    ? result
    : fail(sourceId, path, "computed boundary is not finite and non-negative");
}
```

Export only the shared public contract from `src/index.ts` until the adapter files are added:

```ts
export { TimelineSourceParseError } from "./errors.js";
export type { TimelineSource, TimelineSourceOptions } from "./types.js";
```

- [ ] **Step 4: Run the focused tests and package build**

Run: `pnpm exec vitest run packages/timeline-sources/src/types.test.ts`

Expected: PASS.

Run: `pnpm --filter @puppetflow/timeline-sources build`

Expected: PASS with `dist/index.js` and `dist/index.d.ts` generated.

- [ ] **Step 5: Commit the shared package foundation**

```bash
git add packages/timeline-sources
git commit -m "feat(timeline-sources): add source contract"
```

### Task 2: Rhubarb JSON adapter

**Files:**

- Create: `packages/timeline-sources/src/rhubarb.ts`
- Test: `packages/timeline-sources/src/rhubarb.test.ts`
- Modify: `packages/timeline-sources/src/index.ts`

**Interfaces:**

- Consumes: shared validation helpers, `TimelineSource`, `TimelineSourceOptions`, `TimelineSourceParseError`, and Core `TimelineEvent`.
- Produces: `parseRhubarbJson(input: unknown, options?: TimelineSourceOptions): readonly TimelineEvent[]` and `rhubarbJsonSource: TimelineSource<unknown>` with `id === "rhubarb"`.

- [ ] **Step 1: Write failing Rhubarb conversion and rejection tests**

Create a fixture that proves seconds-to-milliseconds conversion, lower-case normalization, offset, gaps, and source-specific output:

```ts
import { describe, expect, it } from "vitest";
import { TimelineSourceParseError } from "./errors.js";
import { parseRhubarbJson } from "./rhubarb.js";

describe("parseRhubarbJson", () => {
  it("converts ordered cues without filling gaps", () => {
    const input = {
      metadata: { duration: 0.5 },
      mouthCues: [
        { start: 0, end: 0.12, value: "a" },
        { start: 0.2, end: 0.5, value: "X" },
      ],
    };

    expect(parseRhubarbJson(input, { offsetMs: 20 })).toEqual([
      {
        startMs: 20,
        endMs: 140,
        type: "rhubarb-mouth",
        value: { shape: "A" },
      },
      {
        startMs: 220,
        endMs: 520,
        type: "rhubarb-mouth",
        value: { shape: "X" },
      },
    ]);
  });

  it("rejects malformed, unknown, overlapping, descending, and rounded-empty cues", () => {
    const cases: Array<[unknown, string]> = [
      [{}, "mouthCues"],
      [{ mouthCues: [{ start: 0, end: 1, value: "Z" }] }, "mouthCues[0].value"],
      [
        {
          mouthCues: [
            { start: 0, end: 0.2, value: "A" },
            { start: 0.1, end: 0.3, value: "B" },
          ],
        },
        "mouthCues[1].start",
      ],
      [
        { mouthCues: [{ start: Number.NaN, end: 0.1, value: "A" }] },
        "mouthCues[0].start",
      ],
      [{ mouthCues: [{ start: 0.001, end: 0.0011, value: "A" }] }, "mouthCues[0].end"],
    ];

    for (const [input, path] of cases) {
      try {
        parseRhubarbJson(input);
        throw new Error(`expected rejection at ${path}`);
      } catch (error) {
        expect(error).toBeInstanceOf(TimelineSourceParseError);
        expect((error as TimelineSourceParseError).sourceId).toBe("rhubarb");
        expect((error as TimelineSourceParseError).path).toBe(path);
      }
    }
  });

  it("validates metadata, handles empty cues, and never mutates input", () => {
    const input = { metadata: { duration: 0 }, mouthCues: [] };
    const before = structuredClone(input);

    expect(parseRhubarbJson(input)).toEqual([]);
    expect(input).toEqual(before);
    expect(() =>
      parseRhubarbJson({ metadata: { duration: -1 }, mouthCues: [] }),
    ).toThrow(TimelineSourceParseError);
  });
});
```

- [ ] **Step 2: Run the Rhubarb test to verify it fails**

Run: `pnpm exec vitest run packages/timeline-sources/src/rhubarb.test.ts`

Expected: FAIL because `rhubarb.ts` does not exist yet.

- [ ] **Step 3: Implement the Rhubarb adapter**

In `src/rhubarb.ts`, parse a record with required `mouthCues` array and optional record `metadata`; validate optional `metadata.duration` as finite and non-negative. For each cue, require finite non-negative `start`/`end` seconds and a string shape in `A`–`H`/`X` after uppercasing. Reject raw `end <= start`, raw overlap/descending order, rounded or offset arithmetic overflow, rounded `endMs <= startMs`, and rounded overlap. Emit only fresh objects:

```ts
const SOURCE_ID = "rhubarb" as const;
const SHAPES = new Set(["A", "B", "C", "D", "E", "F", "G", "H", "X"]);

export function parseRhubarbJson(
  input: unknown,
  options?: TimelineSourceOptions,
): readonly TimelineEvent[] {
  const root = requireRecord(SOURCE_ID, "input", input);
  const offsetMs = parseOffsetMs(SOURCE_ID, options);
  const cues = requireArray(SOURCE_ID, "mouthCues", root.mouthCues);
  const events: TimelineEvent[] = [];
  let previousEndSeconds = 0;
  let previousEndMs: number | undefined;

  for (const [index, rawCue] of cues.entries()) {
    const path = `mouthCues[${index}]`;
    const cue = requireRecord(SOURCE_ID, path, rawCue);
    const start = requireFiniteNumber(SOURCE_ID, `${path}.start`, cue.start, 0);
    const end = requireFiniteNumber(SOURCE_ID, `${path}.end`, cue.end, 0);
    const rawShape = cue.value;
    const shape = typeof rawShape === "string" ? rawShape.toUpperCase() : "";
    if (!SHAPES.has(shape)) {
      throw new TimelineSourceParseError(
        SOURCE_ID,
        `${path}.value`,
        "unknown mouth shape",
      );
    }
    if (end <= start || start < previousEndSeconds) {
      throw new TimelineSourceParseError(
        SOURCE_ID,
        `${path}.start`,
        "cue interval is not ordered",
      );
    }

    const startMs = addOffset(
      SOURCE_ID,
      `${path}.start`,
      offsetMs,
      Math.round(start * 1000),
    );
    const endMs = addOffset(SOURCE_ID, `${path}.end`, offsetMs, Math.round(end * 1000));
    if (endMs <= startMs || (previousEndMs !== undefined && startMs < previousEndMs)) {
      throw new TimelineSourceParseError(
        SOURCE_ID,
        `${path}.end`,
        "rounded cue interval is invalid",
      );
    }
    events.push({ startMs, endMs, type: "rhubarb-mouth", value: { shape } });
    previousEndSeconds = end;
    previousEndMs = endMs;
  }

  return events;
}

export const rhubarbJsonSource: TimelineSource<unknown> = {
  id: SOURCE_ID,
  parse: parseRhubarbJson,
};
```

The implementation must construct each value as `{ shape }`, use `Math.round(seconds * 1000)` before adding `offsetMs`, preserve gaps, and use `type: "rhubarb-mouth"`. Do not insert Rest events or map shapes to `phoneme`.

- [ ] **Step 4: Run Rhubarb tests and declaration build**

Run: `pnpm exec vitest run packages/timeline-sources/src/rhubarb.test.ts`

Expected: PASS.

Run: `pnpm --filter @puppetflow/timeline-sources build`

Expected: PASS and the declaration contains `parseRhubarbJson` and `rhubarbJsonSource`.

- [ ] **Step 5: Commit the Rhubarb adapter**

```bash
git add packages/timeline-sources/src/index.ts packages/timeline-sources/src/rhubarb.ts packages/timeline-sources/src/rhubarb.test.ts
git commit -m "feat(timeline-sources): add Rhubarb adapter"
```

### Task 3: VOICEVOX AudioQuery adapter

**Files:**

- Create: `packages/timeline-sources/src/voicevox.ts`
- Test: `packages/timeline-sources/src/voicevox.test.ts`
- Modify: `packages/timeline-sources/src/index.ts`

**Interfaces:**

- Consumes: shared validation helpers, `TimelineSource`, `TimelineSourceOptions`, `TimelineSourceParseError`, and Core `TimelineEvent`.
- Produces: `parseVoicevoxAudioQuery(input: unknown, options?: TimelineSourceOptions): readonly TimelineEvent[]` and `voicevoxAudioQuerySource: TimelineSource<unknown>` with `id === "voicevox-audio-query"`.

- [ ] **Step 1: Write failing VOICEVOX timing and rejection tests**

Use a mixed-naming AudioQuery fixture with one consonant-bearing mora, a pause, a second mora, pre/post silence, `speedScale`, and `offsetMs`:

```ts
import { describe, expect, it } from "vitest";
import { TimelineSourceParseError } from "./errors.js";
import { parseVoicevoxAudioQuery } from "./voicevox.js";

const query = {
  prePhonemeLength: 0.1,
  postPhonemeLength: 0.2,
  speedScale: 2,
  accent_phrases: [
    {
      moras: [{ vowel: "a", vowel_length: 0.2, consonant: "k", consonant_length: 0.1 }],
      pause_mora: { vowel: "pau", vowel_length: 0.3 },
    },
    { moras: [{ vowel: "N", vowel_length: 0.05 }] },
  ],
};

describe("parseVoicevoxAudioQuery", () => {
  it("lays out silence, mora, pause, speed, and offset in order", () => {
    expect(parseVoicevoxAudioQuery(query, { offsetMs: 10 })).toEqual([
      {
        startMs: 10,
        endMs: 60,
        type: "phoneme",
        value: { phoneme: "Rest", strength: 1 },
      },
      {
        startMs: 60,
        endMs: 210,
        type: "phoneme",
        value: { phoneme: "A", strength: 1 },
      },
      {
        startMs: 210,
        endMs: 360,
        type: "phoneme",
        value: { phoneme: "Rest", strength: 1 },
      },
      {
        startMs: 360,
        endMs: 385,
        type: "phoneme",
        value: { phoneme: "N", strength: 1 },
      },
      {
        startMs: 385,
        endMs: 485,
        type: "phoneme",
        value: { phoneme: "Rest", strength: 1 },
      },
    ]);
  });

  it("applies pause overrides, normalizes silence, skips zero lengths, and preserves input", () => {
    const input = {
      ...query,
      prePhonemeLength: 0,
      postPhonemeLength: 0,
      speedScale: 1,
      pauseLength: 0.4,
      pauseLengthScale: 0.5,
      accent_phrases: [
        {
          moras: [
            { vowel: "sil", vowel_length: 0 },
            { vowel: "i", vowel_length: 0.1 },
          ],
        },
        { moras: [], pause_mora: { vowel: "pau", vowel_length: 0.2 } },
      ],
    };
    const before = structuredClone(input);

    expect(parseVoicevoxAudioQuery(input)).toEqual([
      { startMs: 0, endMs: 100, type: "phoneme", value: { phoneme: "I", strength: 1 } },
      {
        startMs: 100,
        endMs: 300,
        type: "phoneme",
        value: { phoneme: "Rest", strength: 1 },
      },
    ]);
    expect(input).toEqual(before);
  });

  it("emits pre/post Rest events for a valid empty phrase list", () => {
    expect(
      parseVoicevoxAudioQuery({
        prePhonemeLength: 0.01,
        postPhonemeLength: 0.02,
        speedScale: 1,
        accent_phrases: [],
      }),
    ).toEqual([
      {
        startMs: 0,
        endMs: 10,
        type: "phoneme",
        value: { phoneme: "Rest", strength: 1 },
      },
      {
        startMs: 10,
        endMs: 30,
        type: "phoneme",
        value: { phoneme: "Rest", strength: 1 },
      },
    ]);
  });

  it.each([
    ["accent_phrases[0].moras[0].vowel", "q"],
    ["speedScale", 0],
    ["accent_phrases[0].moras[0].vowel_length", Number.NaN],
    ["accent_phrases[0].moras", null],
  ])("rejects invalid field %s", (path, value) => {
    const invalid = structuredClone(query) as Record<string, unknown>;
    if (path === "speedScale") {
      invalid.speedScale = value;
    } else if (path.endsWith(".moras")) {
      (invalid.accent_phrases as Array<Record<string, unknown>>)[0]!.moras = value;
    } else {
      const phrase = (invalid.accent_phrases as Array<Record<string, unknown>>)[0]!;
      const mora = (phrase.moras as Array<Record<string, unknown>>)[0]!;
      mora.vowel = value;
    }

    try {
      parseVoicevoxAudioQuery(invalid);
      throw new Error("expected TimelineSourceParseError");
    } catch (error) {
      expect(error).toBeInstanceOf(TimelineSourceParseError);
      expect((error as TimelineSourceParseError).sourceId).toBe("voicevox-audio-query");
      expect((error as TimelineSourceParseError).path).toBe(path);
    }
  });
});
```

- [ ] **Step 2: Run the VOICEVOX test to verify it fails**

Run: `pnpm exec vitest run packages/timeline-sources/src/voicevox.test.ts`

Expected: FAIL because `voicevox.ts` does not exist yet.

- [ ] **Step 3: Implement the VOICEVOX adapter**

In `src/voicevox.ts`, require `accent_phrases`, `prePhonemeLength`, `postPhonemeLength`, and positive finite `speedScale`. Treat optional official `null` fields as absent. Normalize case-insensitive `a/i/u/e/o/N/sil/pau` to `A/I/U/E/O/N/Rest`; reject any other vowel. Read optional finite non-negative `pauseLength` (including `null`) and finite non-negative `pauseLengthScale` (default `1`); a negative pause override would create a backwards cursor and is rejected.

Use a seconds cursor and one emitter so raw timing advances even when a rounded interval is skipped:

```ts
type Phoneme = "A" | "I" | "U" | "E" | "O" | "N" | "Rest";
const SOURCE_ID = "voicevox-audio-query" as const;
let cursorSeconds = 0;
const events: TimelineEvent[] = [];

function emit(durationSeconds: number, phoneme: Phoneme, path: string): void {
  const startSeconds = cursorSeconds;
  const scaledSeconds = durationSeconds / speedScale;
  requireFiniteNumber(SOURCE_ID, path, scaledSeconds, 0);
  cursorSeconds += scaledSeconds;
  requireFiniteNumber(SOURCE_ID, path, cursorSeconds, 0);

  const startMs = addOffset(SOURCE_ID, path, offsetMs, Math.round(startSeconds * 1000));
  const endMs = addOffset(SOURCE_ID, path, offsetMs, Math.round(cursorSeconds * 1000));
  if (endMs < startMs) {
    throw new TimelineSourceParseError(SOURCE_ID, path, "rounded time moved backwards");
  }
  if (endMs === startMs) {
    return;
  }
  events.push({
    startMs,
    endMs,
    type: "phoneme",
    value: { phoneme, strength: 1 },
  });
}
```

Call `emit(prePhonemeLength, "Rest", "prePhonemeLength")`; for each phrase, validate its `moras` array and call `emit` once per mora with `(consonant_length ?? 0) + vowel_length` and the normalized vowel. Treat an omitted or `null` `consonant_length` as `0`; if `consonant` is present and non-null, require it to be a string even though its value is not emitted. If `pause_mora` exists (including the official nullable field), validate its timing fields, choose `pauseLength ?? pause_mora.vowel_length`, multiply by `pauseLengthScale`, and emit `Rest`; finally call `emit(postPhonemeLength, "Rest", "postPhonemeLength")`. A malformed later entry still throws before the function returns any events. Ignore pitch, text, kana, speaker, and unrelated fields. Export `voicevoxAudioQuerySource` with `id === "voicevox-audio-query"`.

- [ ] **Step 4: Run VOICEVOX tests and declaration build**

Run: `pnpm exec vitest run packages/timeline-sources/src/voicevox.test.ts`

Expected: PASS, including exact millisecond boundaries and error paths.

Run: `pnpm --filter @puppetflow/timeline-sources build`

Expected: PASS and the declaration contains `parseVoicevoxAudioQuery` and `voicevoxAudioQuerySource`.

- [ ] **Step 5: Commit the VOICEVOX adapter**

```bash
git add packages/timeline-sources/src/index.ts packages/timeline-sources/src/voicevox.ts packages/timeline-sources/src/voicevox.test.ts
git commit -m "feat(timeline-sources): add VOICEVOX adapter"
```

### Task 4: Public reference documentation and workspace lockfile

**Files:**

- Create: `docs/reference/timeline-sources.md`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: the public exports and timing guarantees implemented in Tasks 1–3.
- Produces: user-facing format/reference documentation and a lockfile importer entry for `@puppetflow/timeline-sources`.

- [ ] **Step 1: Write the reference page**

Create `docs/reference/timeline-sources.md` with the following complete content, adjusting only Markdown line wrapping through Prettier:

````markdown
# Timeline Sources

`@puppetflow/timeline-sources` converts already-loaded source JSON into
`@puppetflow/core` `TimelineEvent` values. It performs no file, network, audio,
Runtime, or Studio I/O.

## Common API

```ts
import {
  parseRhubarbJson,
  parseVoicevoxAudioQuery,
} from "@puppetflow/timeline-sources";

const events = parseRhubarbJson(json, { offsetMs: 12 });
runtime.timeline.pushMany([...events]);
```

`offsetMs` places source-relative time on Runtime's global elapsed-time clock.
The parser returns a complete ordered result or throws
`TimelineSourceParseError`; it never returns partial output.

## Rhubarb JSON

`mouthCues[].start` and `mouthCues[].end` are seconds. The adapter accepts
`A`–`H` and `X` (case-insensitive), rounds seconds to integer milliseconds, and
emits source-specific `rhubarb-mouth` events:

```json
{
  "mouthCues": [
    { "start": 0, "end": 0.12, "value": "A" },
    { "start": 0.2, "end": 0.5, "value": "X" }
  ]
}
```

```json
[
  {
    "startMs": 0,
    "endMs": 120,
    "type": "rhubarb-mouth",
    "value": { "shape": "A" }
  },
  {
    "startMs": 200,
    "endMs": 500,
    "type": "rhubarb-mouth",
    "value": { "shape": "X" }
  }
]
```

Gaps remain gaps. The codes are mouth-shape/viseme data, not Japanese
phonemes, so the package does not relabel or automatically map them.

## VOICEVOX AudioQuery JSON

The input uses `accent_phrases`, each phrase's `moras` and optional
`pause_mora`, `prePhonemeLength`, `postPhonemeLength`, and positive
`speedScale`. A mora's `consonant_length` and `vowel_length` are seconds; the
two lengths are combined into one event. Optional `pauseLength` and
`pauseLengthScale` adjust pause mora durations.

```json
{
  "prePhonemeLength": 0.1,
  "postPhonemeLength": 0.2,
  "speedScale": 2,
  "accent_phrases": [
    {
      "moras": [{ "vowel": "a", "consonant_length": 0.1, "vowel_length": 0.2 }],
      "pause_mora": { "vowel": "pau", "vowel_length": 0.3 }
    }
  ]
}
```

Durations are divided by `speedScale`, laid out as pre-silence, mora,
pause-mora, and post-silence, and rounded at each cumulative boundary. Vowels
`a/i/u/e/o/N/sil/pau` normalize to `A/I/U/E/O/N/Rest`:

```json
[
  {
    "startMs": 0,
    "endMs": 50,
    "type": "phoneme",
    "value": { "phoneme": "Rest", "strength": 1 }
  },
  {
    "startMs": 50,
    "endMs": 200,
    "type": "phoneme",
    "value": { "phoneme": "A", "strength": 1 }
  },
  {
    "startMs": 200,
    "endMs": 350,
    "type": "phoneme",
    "value": { "phoneme": "Rest", "strength": 1 }
  },
  {
    "startMs": 350,
    "endMs": 450,
    "type": "phoneme",
    "value": { "phoneme": "Rest", "strength": 1 }
  }
]
```

## Validation

All times, durations, speed controls, offsets, and computed boundaries must be
finite and non-negative (with `speedScale > 0`). Inputs are not mutated.
Malformed objects, unknown shapes/vowels, descending or overlapping Rhubarb
cues, and invalid timing values throw `TimelineSourceParseError` with a source
ID and field path before the result is returned.
````

- [ ] **Step 2: Add the workspace importer without broad dependency updates**

Run: `pnpm install --lockfile-only`

Expected: `pnpm-lock.yaml` gains an importer entry for `packages/timeline-sources` with only `@puppetflow/core: workspace:*` and `tsup: ^8.5.0`; unrelated package versions remain unchanged.

- [ ] **Step 3: Format and check the documentation/lockfile diff**

Run: `pnpm exec prettier --write docs/reference/timeline-sources.md`

Run: `git -c safe.directory=D:/99.AITuber/PuppetFlow diff --check`

Expected: both commands succeed with no whitespace errors.

- [ ] **Step 4: Commit the docs and lockfile**

```bash
git add docs/reference/timeline-sources.md pnpm-lock.yaml
git commit -m "docs(timeline-sources): document source formats"
```

### Task 5: Full verification and final self-review

**Files:**

- Inspect: `packages/timeline-sources/src/*.ts`
- Inspect: `docs/reference/timeline-sources.md`
- Inspect: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: all package code, tests, declarations, and documentation from Tasks 1–4.
- Produces: fresh evidence that the package meets the approved acceptance criteria without changing existing Runtime/Core/source/preset behavior.

- [ ] **Step 1: Run focused package tests and build**

Run: `pnpm --filter @puppetflow/timeline-sources test`

Run: `pnpm --filter @puppetflow/timeline-sources build`

Expected: both PASS; inspect `packages/timeline-sources/dist/index.d.ts` and confirm it exports the interface, error, both parser functions, and both source constants.

- [ ] **Step 2: Run repository lint, formatting, build, and tests**

Run: `pnpm lint`

Run: `pnpm format:check`

Run: `pnpm build`

Run: `pnpm test`

Expected: all PASS, including existing packages; no Runtime, Core, source, or preset files are modified by the new package.

- [ ] **Step 3: Run the repository verification gate**

Run: `pnpm verify`

Expected: PASS, including the preset-diff guard. If a command fails, fix only the demonstrated issue, rerun the narrow failing command, then rerun the full gate.

- [ ] **Step 4: Review the complete diff and repository state**

Run: `git -c safe.directory=D:/99.AITuber/PuppetFlow status --short --branch`

Run: `git -c safe.directory=D:/99.AITuber/PuppetFlow diff origin/main..HEAD --stat`

Run: `git -c safe.directory=D:/99.AITuber/PuppetFlow diff origin/main..HEAD --check`

Confirm only the approved design/plan docs, new package and tests, reference page, and lockfile importer changed; confirm no generated `dist` files are tracked and no secret, Runtime, Studio, network, or unrelated refactor was added. Record exact command outcomes for the eventual PR/merge review.
