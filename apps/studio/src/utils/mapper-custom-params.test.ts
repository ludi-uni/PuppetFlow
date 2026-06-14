import { describe, expect, it } from "vitest";
import { collectMapperCustomParamIds } from "./mapper-custom-params.js";

describe("collectMapperCustomParamIds", () => {
  it("includes PFScript custom keys alongside extension parameters", () => {
    const presetJson = JSON.stringify({
      version: 3,
      behaviorPfScript: `
if currentPhoneme == "A" then
    MouthA = 1
end
`,
      graph: { nodes: [], edges: [] },
    });
    const extensionsJson = JSON.stringify({ packs: [] });

    expect(collectMapperCustomParamIds(presetJson, extensionsJson)).toEqual([
      "MouthA",
      "earAngle",
      "tailWag",
    ]);
  });

  it("falls back to cached behavior when PFScript fails to compile", () => {
    const presetJson = JSON.stringify({
      version: 3,
      behaviorPfScript: "while true do end",
      behavior: {
        type: "Block",
        statements: [
          {
            type: "ExprAssign",
            target: "custom:MouthO",
            value: { type: "Number", value: 1 },
          },
        ],
      },
      graph: { nodes: [], edges: [] },
    });

    expect(collectMapperCustomParamIds(presetJson, "{}")).toContain("MouthO");
  });
});
