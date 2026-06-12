export type PhonemeInputSource = "timeline" | "channel" | "none";

export function resolvePhonemeInputSource(
  activeTimelineEvents: Array<{ type: string }>,
  channelPhoneme: unknown,
): PhonemeInputSource {
  if (activeTimelineEvents.some((event) => event.type === "phoneme")) {
    return "timeline";
  }

  if (typeof channelPhoneme === "string" && channelPhoneme !== "Rest") {
    return "channel";
  }

  return "none";
}

export function phonemeSourceLabel(source: PhonemeInputSource): string {
  switch (source) {
    case "timeline":
      return "Timeline（一時イベント優先）";
    case "channel":
      return "Channel（常時 phoneme）";
    default:
      return "なし（Rest）";
  }
}
