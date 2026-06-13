import { StateStore } from "@puppetflow/core";
import { describe, expect, it } from "vitest";
import { applyStatePayload } from "./parse-state-payload.js";

describe("applyStatePayload", () => {
  it("maps payload values into the state store", () => {
    const store = new StateStore();
    applyStatePayload(store, { interest: 0.8, nested: { bad: true } });

    expect(store.get("interest")).toBe(0.8);
    expect(store.get("nested")).toBeUndefined();
  });

  it("rejects oversized state maps", () => {
    const store = new StateStore();
    const payload = Object.fromEntries(
      Array.from({ length: 129 }, (_, index) => [`key${index}`, index]),
    );

    expect(() => applyStatePayload(store, payload)).toThrow(/state exceeds max keys/i);
  });
});
