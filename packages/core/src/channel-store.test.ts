import { describe, expect, it, vi } from "vitest";
import { ChannelStore } from "./channel-store.js";

describe("ChannelStore", () => {
  it("stores and retrieves sticky values", () => {
    const store = new ChannelStore();
    store.set("volume", 0.6);
    expect(store.get("volume")).toBe(0.6);
    expect(store.get("volume")).toBe(0.6);
  });

  it("notifies subscribers on set and delete", () => {
    const store = new ChannelStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.set("phoneme", "A");
    expect(listener).toHaveBeenCalledWith("phoneme", "A");

    store.delete("phoneme");
    expect(listener).toHaveBeenCalledWith("phoneme", undefined);
  });

  it("returns all channel values", () => {
    const store = new ChannelStore();
    store.set("volume", 0.5);
    store.set("emotion", "joy");
    expect(store.getAll()).toEqual({ volume: 0.5, emotion: "joy" });
  });
});
