import { describe, expect, it } from "vitest";
import {
  formatChannelTableRows,
  formatTimelineTableRows,
} from "./useMotionPipeline";

describe("useMotionPipeline helpers", () => {
  it("formats channel snapshot rows", () => {
    const rows = formatChannelTableRows({
      volume: 0.42,
      phoneme: "A",
    });

    expect(rows).toEqual([
      { key: "volume", value: "0.420" },
      { key: "phoneme", value: "A" },
    ]);
  });

  it("formats timeline event rows", () => {
    const rows = formatTimelineTableRows([
      {
        startMs: 0,
        endMs: 150,
        type: "phoneme",
        value: { phoneme: "A", strength: 1 },
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.key).toBe("phoneme #1");
    expect(rows[0]?.value).toContain("0–150 ms");
  });
});
