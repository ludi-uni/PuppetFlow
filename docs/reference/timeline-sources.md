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
