# Timeline Sources Design

**Status:** Draft for user review
**Date:** 2026-08-27

## Goal

Add a small, pure `@puppetflow/timeline-sources` package that converts
Rhubarb Lip Sync JSON and VOICEVOX AudioQuery JSON into PuppetFlow
`TimelineEvent` values. The package must be usable by a bridge or application
without importing Runtime, Studio, a filesystem API, a network client, or a
VOICEVOX engine implementation.

## Scope

### In scope

- A typed `TimelineSource<Input>` interface with a stable `id` and `parse()`.
- A finite, non-negative `offsetMs` option for placing relative source time on
  Runtime's global timeline.
- `TimelineSourceParseError` with source ID and field path context.
- Rhubarb JSON validation and conversion.
- VOICEVOX AudioQuery validation and conversion.
- Deterministic unit tests, package build metadata, and public reference docs.

### Out of scope

- Runtime, Studio, HTTP, WebSocket, MQTT, or CLI integration.
- Reading files, invoking Rhubarb, calling a VOICEVOX server, or decoding audio.
- Mapping Rhubarb viseme codes to Japanese phonemes. Rhubarb codes are retained
  as source-specific mouth-shape events.
- New Core or Preset fields, timeline reset APIs, or a new timeline clock.
- Model-specific phoneme tables or automatic voice/language detection.

## Existing contract

`@puppetflow/core` already defines:

```ts
interface TimelineEvent {
  startMs: number;
  endMs: number;
  type: string;
  value: unknown;
}
```

Events are relative to Runtime's global `elapsedTime * 1000` clock. Consumers
are responsible for choosing the `offsetMs` at which a source-relative result
is pushed into `runtime.timeline`.

## Public API

The new package exposes the following additive API:

```ts
import type { TimelineEvent } from "@puppetflow/core";

export interface TimelineSourceOptions {
  readonly offsetMs?: number;
}

export interface TimelineSource<Input = unknown> {
  readonly id: string;
  parse(input: Input, options?: TimelineSourceOptions): readonly TimelineEvent[];
}

export class TimelineSourceParseError extends Error {
  readonly sourceId: string;
  readonly path: string;
}

export function parseRhubarbJson(
  input: unknown,
  options?: TimelineSourceOptions,
): readonly TimelineEvent[];

export function parseVoicevoxAudioQuery(
  input: unknown,
  options?: TimelineSourceOptions,
): readonly TimelineEvent[];

export const rhubarbJsonSource: TimelineSource<unknown>;
export const voicevoxAudioQuerySource: TimelineSource<unknown>;
```

The parser functions return a complete result or throw. They never return a
partially converted event list. `offsetMs` defaults to `0` and must be finite
and non-negative. Every emitted event has finite, non-negative boundaries with
`endMs > startMs`; events are returned in timeline order.

## Common validation and error behavior

- `null`, arrays where an object is required, missing required arrays, and
  non-object entries are rejected. Optional VOICEVOX fields whose official
  value is `null` are treated as absent.
- Times, durations, `speedScale`, and optional numeric timing controls must be
  finite numbers with the documented sign constraints.
- After applying `offsetMs`, computed boundaries must remain finite and
  non-negative; arithmetic overflow is rejected as a parse error.
- A source-specific error includes a stable source ID (`rhubarb` or
  `voicevox-audio-query`) and a path such as `mouthCues[2].end` or
  `accent_phrases[0].moras[1].vowel_length`.
- Input objects and nested values are never mutated.
- An empty valid cue/mora list returns an empty list unless valid pre/post
  silence creates an event.

## Rhubarb JSON adapter

Rhubarb's JSON result has an optional `metadata` object and a `mouthCues` array.
Each cue contains `start`, `end`, and `value`; timestamps are seconds. The
adapter accepts the official basic and extended shape codes `A` through `H`
and `X`, normalizes lowercase input to uppercase, and converts seconds to
integer milliseconds with `Math.round(seconds * 1000)`.

Each cue becomes:

```ts
{
  startMs: offsetMs + round(cue.start * 1000),
  endMs: offsetMs + round(cue.end * 1000),
  type: "rhubarb-mouth",
  value: { shape: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "X" },
}
```

The adapter requires `end > start` and rejects overlapping or descending cue
intervals. The rounded, offset boundaries must also remain finite and satisfy
`endMs > startMs` with no overlap; otherwise the cue is rejected. Gaps are
preserved as gaps; no synthetic Rest cue is inserted. The official
`metadata.duration`, when present, must be finite and non-negative but is not
required for conversion and is not emitted as a separate event.

Rhubarb mouth shapes are deliberately not relabeled as `phoneme` events. A
future mapper can choose an art- or model-specific viseme mapping without
corrupting the source data in this package.

## VOICEVOX AudioQuery adapter

The input uses the mixed field naming of the VOICEVOX Engine AudioQuery JSON:

- `accent_phrases` is an array of phrases.
- Each phrase has `moras` and an optional `pause_mora`.
- A mora has `vowel`, `vowel_length`, and optional
  `consonant_length`/`consonant`.
- `prePhonemeLength`, `postPhonemeLength`, and `speedScale` are required.
- `pauseLength` and `pauseLengthScale` are optional when present in a newer
  AudioQuery variant.

The accepted vowel values are `a`, `i`, `u`, `e`, `o`, `N`, `sil`, and `pau`,
case-insensitively. They normalize to `A`, `I`, `U`, `E`, `O`, `N`, and `Rest`;
`sil`/`pau` always normalize to `Rest`. Unknown vowel values are rejected.

Timing follows the VOICEVOX synthesis model: pre-silence, consonant/vowel
lengths, pause mora, and post-silence are laid out in order, and each duration
is divided by `speedScale`. The cursor is maintained in seconds and every
emitted boundary is converted with `Math.round(cursorSeconds * 1000)` before
`offsetMs` is added. A sub-millisecond interval may therefore consume time but
round to zero and be skipped. If `pauseLength` is present it replaces a pause
duration before `pauseLengthScale` is applied; the resulting pause is then
scaled by `speedScale` like other phoneme lengths.

Each non-zero mora or silence interval becomes:

```ts
{
  startMs,
  endMs,
  type: "phoneme",
  value: { phoneme: "A" | "I" | "U" | "E" | "O" | "N" | "Rest", strength: 1 },
}
```

Consonant and vowel durations within one mora are combined into one mouth
interval using the mora's normalized vowel. A `pause_mora`, pre-silence, or
post-silence emits `Rest`. Zero-length intervals consume no time and are not
emitted. The adapter does not use pitch, text, kana, or speaker metadata.

## Data flow and lifecycle

```text
Rhubarb JSON --------┐
                     ├─ parse() → readonly TimelineEvent[] → TimelineStore.pushMany()
VOICEVOX AudioQuery -┘
```

The package is synchronous and stateless. It does not retain source state,
schedule timers, or perform I/O. A caller may parse once and push the returned
events to `runtime.timeline`; because the current Core `pushMany` accepts a
mutable `TimelineEvent[]`, the caller passes a shallow array copy (or pushes
events individually). Global clock ownership remains in Runtime.

## Testing and acceptance criteria

1. The package exports the interface, error type, parser functions, and source
   constants with generated declarations.
2. A representative Rhubarb JSON result converts seconds to millisecond
   `rhubarb-mouth` intervals, preserves shape codes, applies `offsetMs`, and
   rejects malformed/overlapping cues.
3. A representative VOICEVOX AudioQuery converts pre/post silence, consonant +
   vowel durations, pause mora, `speedScale`, and `offsetMs` into ordered
   `phoneme` events.
4. Unknown vowel/shape values, non-finite numbers, invalid speed, descending
   intervals, and malformed object/array shapes throw `TimelineSourceParseError`
   with a useful path.
5. Tests prove inputs are not mutated and valid empty inputs are handled.
6. Existing Runtime, Core, source, and preset behavior remains unchanged; the
   new package has no Runtime or network dependency.
7. `docs/reference/timeline-sources.md` documents both input formats, output
   event types, offset semantics, and the explicit Rhubarb viseme boundary.

## Risks and mitigations

| Risk                                                    | Mitigation                                                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Rhubarb viseme codes are mistaken for Japanese phonemes | Preserve `rhubarb-mouth` and document that no automatic mapping occurs.                               |
| VOICEVOX timing drifts from synthesized audio           | Mirror the documented length ordering and `speedScale` application; use fixture-based boundary tests. |
| Invalid external JSON poisons TimelineStore             | Validate the entire input before returning any events and include field paths in errors.              |
| Floating-point seconds create unstable boundaries       | Round converted boundaries to integer milliseconds and test exact fixtures.                           |

## Open questions

None for this scope. Model-specific Rhubarb mapping and Runtime/Studio
integration remain explicitly deferred.

## References

- Rhubarb Lip Sync JSON output format and mouth-shape codes:
  <https://github.com/DanielSWolf/rhubarb-lip-sync/blob/master/README.adoc>
- VOICEVOX AudioQuery/Mora model:
  <https://github.com/VOICEVOX/voicevox_engine/blob/master/voicevox_engine/tts_pipeline/model.py>
- VOICEVOX timing order and `speedScale` application:
  <https://github.com/VOICEVOX/voicevox_engine/blob/master/voicevox_engine/tts_pipeline/tts_engine.py>
