import { describe, expect, it } from "vitest";
import { extractDiscordPayload } from "./discord-source.js";

describe("extractDiscordPayload", () => {
  it("parses JSON object messages", () => {
    const payload = extractDiscordPayload({
      content: '  {"interest": 0.8, "channels": {"volume": 0.5}}  ',
    });

    expect(payload).toEqual({
      interest: 0.8,
      channels: { volume: 0.5 },
    });
  });

  it("returns null for non-json messages", () => {
    expect(extractDiscordPayload({ content: "hello world" })).toBeNull();
    expect(extractDiscordPayload({ content: "[1,2,3]" })).toBeNull();
    expect(extractDiscordPayload({ content: "not valid json {" })).toBeNull();
  });
});
