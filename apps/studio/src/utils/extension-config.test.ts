import { describe, expect, it } from "vitest";
import {
  formatExtensionPackOutputs,
  getActiveExtensionCustomParameterIds,
  parseExtensionCustomParameterRows,
  parseExtensionPackRows,
  serializeExtensions,
} from "./extension-config.js";

describe("extension-config", () => {
  it("lists bundled motion packs with config fields", () => {
    const rows = parseExtensionPackRows(undefined);

    expect(rows.some((row) => row.id === "tailWag")).toBe(true);
    expect(rows.some((row) => row.id === "earTwitch")).toBe(true);

    const tailWag = rows.find((row) => row.id === "tailWag");
    expect(tailWag?.configFields).toHaveLength(1);
    expect(tailWag?.customOutputs).toEqual(["tailWag"]);
  });

  it("shows custom parameter rows when related pack is disabled (manual control)", () => {
    const extensions = {
      packs: [{ id: "tailWag", config: { intensity: 0.8 } }],
      parameterDefaults: { tailWag: 0.2 },
    };

    const customRows = parseExtensionCustomParameterRows(extensions, ["tailWag"]);
    const tailWagParam = customRows.find((row) => row.id === "tailWag");

    expect(tailWagParam?.active).toBe(false);

    const manualRows = parseExtensionCustomParameterRows(extensions, []);
    expect(manualRows.find((row) => row.id === "tailWag")?.active).toBe(true);
    expect(manualRows.find((row) => row.id === "tailWag")?.value).toBe(0.2);
  });

  it("serializes manual custom defaults when related pack is disabled", () => {
    const packRows = parseExtensionPackRows(undefined).map((row) =>
      row.id === "tailWag" ? { ...row, enabled: false } : row,
    );
    const customRows = parseExtensionCustomParameterRows(undefined, []).map((row) =>
      row.id === "tailWag" ? { ...row, value: 0.15 } : row,
    );

    const serialized = serializeExtensions(packRows, customRows);

    expect(serialized.packs).toEqual([]);
    expect(serialized.parameterDefaults).toEqual({ tailWag: 0.15, earAngle: 0.5 });
  });

  it("collects custom parameter ids only when pack is not driving them", () => {
    expect(
      getActiveExtensionCustomParameterIds({
        packs: [{ id: "earTwitch" }],
      }),
    ).toEqual(["tailWag"]);

    expect(getActiveExtensionCustomParameterIds({ packs: [] })).toEqual([
      "earAngle",
      "tailWag",
    ]);
  });

  it("formats pack output hints", () => {
    const row = parseExtensionPackRows(undefined).find(
      (item) => item.id === "thinking",
    );
    expect(row).toBeDefined();
    expect(formatExtensionPackOutputs(row!)).toContain("lookX");
  });
});
