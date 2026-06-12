export type ChannelValue = number | string | boolean;

export interface AudioChannel {
  volume: number;
}

export interface LipSyncChannel {
  phoneme: string;
}

export const OFFICIAL_CHANNEL_KEYS = [
  "volume",
  "phoneme",
  "emotion",
  "gazeTarget",
  "joy",
  "sadness",
  "anger",
] as const;

export type OfficialChannelKey = (typeof OFFICIAL_CHANNEL_KEYS)[number];
