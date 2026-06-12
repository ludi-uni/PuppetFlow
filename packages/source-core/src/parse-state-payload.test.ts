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
});
