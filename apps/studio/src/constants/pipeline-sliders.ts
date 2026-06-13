export const INPUT_SLIDERS = [
  { key: "interest", label: "Interest", simpleLabel: "興味・関心", defaultValue: 0.5 },
  { key: "energy", label: "Energy", simpleLabel: "元気", defaultValue: 0.5 },
  { key: "stress", label: "Stress", simpleLabel: "ストレス", defaultValue: 0.2 },
] as const;

export const CHANNEL_SLIDERS = [
  { key: "volume", label: "Volume", simpleLabel: "声の大きさ", defaultValue: 0 },
] as const;

export const PHONEME_OPTIONS = ["Rest", "A", "I", "U", "E", "O", "N"] as const;

export const EMOTION_CHANNEL_OPTIONS = [
  { value: "", label: "（なし）" },
  { value: "joy", label: "joy" },
  { value: "sadness", label: "sadness" },
  { value: "anger", label: "anger" },
  { value: "curious", label: "curious" },
] as const;

export const TIMELINE_PHONEME_MS = 150;
