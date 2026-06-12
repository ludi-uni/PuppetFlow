import { DEFAULT_MOTION_STATE } from "@puppetflow/core";
import { describe, expect, it, vi } from "vitest";
import { wrapLegacyAdapter } from "./adapter.js";

describe("wrapLegacyAdapter", () => {
  it("wraps a legacy adapter into Adapter v2", async () => {
    const update = vi.fn();
    const adapter = wrapLegacyAdapter("legacy-test", { update });

    await adapter.initialize();
    await adapter.update(DEFAULT_MOTION_STATE, 0.016);
    await adapter.dispose();

    expect(adapter.id).toBe("legacy-test");
    expect(update).toHaveBeenCalledWith(DEFAULT_MOTION_STATE);
  });
});
