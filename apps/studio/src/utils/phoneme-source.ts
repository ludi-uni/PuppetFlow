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

export function phonemeSourceLabel(
  source: PhonemeInputSource,
  simpleMode = false,
): string {
  if (simpleMode) {
    switch (source) {
      case "timeline":
        return "一瞬送った口の形";
      case "channel":
        return "選んだ口の形（あいうえお）";
      default:
        return "休止（口を閉じる）";
    }
  }

  switch (source) {
    case "timeline":
      return "Timeline（一時イベント優先）";
    case "channel":
      return "Channel（常時 phoneme）";
    default:
      return "なし（Rest）";
  }
}
