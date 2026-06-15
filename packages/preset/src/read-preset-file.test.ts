import { describe, expect, it } from "vitest";

import { readPresetFileSync } from "./read-preset-file.js";

describe("readPresetFile", () => {
  it("loads a preset JSON file from disk", () => {
    const loaded = readPresetFileSync("examples/pfscript/pfscript-demo.pfpreset");

    expect(loaded.name).toBeTruthy();
    expect(loaded.graph.nodes.length).toBeGreaterThan(0);
  });
});
