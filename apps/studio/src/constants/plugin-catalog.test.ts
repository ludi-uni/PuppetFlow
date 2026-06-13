import { describe, expect, it } from "vitest";
import { PLUGIN_MOTION_OUTPUTS } from "@puppetflow/core";
import { PLUGIN_CATALOG, type CatalogPluginId } from "./plugin-catalog.js";

describe("PLUGIN_CATALOG", () => {
  it("keeps motionOutputs in sync with PLUGIN_MOTION_OUTPUTS", () => {
    for (const entry of PLUGIN_CATALOG) {
      const expected = PLUGIN_MOTION_OUTPUTS[entry.id as CatalogPluginId];
      expect(expected, `missing core outputs for ${entry.id}`).toBeDefined();
      expect(entry.motionOutputs).toEqual([...(expected ?? [])]);
    }
  });
});
