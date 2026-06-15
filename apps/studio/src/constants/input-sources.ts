export const INPUT_SOURCE_PAYLOAD_EXAMPLE = `{
  "state": { "interest": 0.8, "energy": 0.6 },
  "channels": {
    "volume": 0.6,
    "phoneme": "A",
    "emotion": "joy"
  },
  "motion": {
    "mouthX": 0.7,
    "lookX": 0.4,
    "lookY": 0.5,
    "custom": {
      "heartbeat": 0.6
    }
  },
  "timeline": [
    {
      "startMs": 0,
      "endMs": 120,
      "type": "phoneme",
      "value": { "phoneme": "A", "strength": 1.0 }
    }
  ]
}`;
