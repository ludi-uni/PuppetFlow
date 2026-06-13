import { describe, expect, it } from "vitest";
import {
  findDuplicateExtensionPackIds,
  findDuplicateExtensionPackIdsFromGraphJson,
  formatDuplicatePackWarning,
} from "./extension-duplicates.js";

describe("extension-duplicates", () => {
  it("detects packs duplicated between extensions and graph nodes", () => {
    const presetJson = JSON.stringify({
      version: 3,
      extensions: { packs: [{ id: "thinking" }] },
      behavior: { type: "Block", statements: [] },
    });

    const report = findDuplicateExtensionPackIds(presetJson, [
      {
        id: "n1",
        type: "motionPack",
        position: { x: 0, y: 0 },
        data: { packId: "thinking" },
      },
    ]);

    expect(report.presetAndGraph).toEqual(["thinking"]);
    expect(formatDuplicatePackWarning(report)).toMatch(/thinking/);
  });

  it("detects packs duplicated between extensions and graph JSON", () => {
    const presetJson = JSON.stringify({
      version: 3,
      extensions: { packs: [{ id: "thinking" }] },
      behavior: { type: "Block", statements: [] },
    });
    const graphJson = JSON.stringify({
      nodes: [{ id: "n1", type: "motionPack", data: { packId: "thinking" } }],
      edges: [],
    });

    const report = findDuplicateExtensionPackIdsFromGraphJson(presetJson, graphJson);

    expect(report.presetAndGraph).toEqual(["thinking"]);
  });
});
