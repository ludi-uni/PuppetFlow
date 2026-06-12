import { describe, expect, it } from "vitest";
import { StateStore } from "./state-store.js";

describe("StateStore", () => {
  it("sets and gets values", () => {
    const store = new StateStore();
    store.set("interest", 0.8);

    expect(store.get("interest")).toBe(0.8);
  });

  it("returns undefined for unknown keys", () => {
    const store = new StateStore();

    expect(store.get("missing")).toBeUndefined();
  });

  it("overwrites existing values", () => {
    const store = new StateStore();
    store.set("energy", 0.3);
    store.set("energy", 0.9);

    expect(store.get("energy")).toBe(0.9);
  });
});
