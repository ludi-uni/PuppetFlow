import { compilePfScript } from "@puppetflow/pfscript-core";
import { describe, expect, it } from "vitest";
import {
  findStatefulPluginConflicts,
  formatStatefulPluginConflictWarning,
} from "./stateful-conflicts.js";

describe("findStatefulPluginConflicts", () => {
  it("warns when gaze plugin overlaps lookX assignment", () => {
    const behavior = compilePfScript("lookX = 0.5");
    const warnings = findStatefulPluginConflicts(
      JSON.stringify([{ id: "gaze" }]),
      behavior,
    );

    expect(warnings).toHaveLength(1);
    expect(formatStatefulPluginConflictWarning(warnings)).toContain("lookX");
    expect(formatStatefulPluginConflictWarning(warnings)).toContain("gaze");
  });

  it("does not warn when blink plugin layers PFScript eyeYaw", () => {
    const behavior = compilePfScript("eyeYaw = energy * 0.3");
    const warnings = findStatefulPluginConflicts(
      JSON.stringify([{ id: "blink" }]),
      behavior,
    );

    expect(warnings).toEqual([]);
  });

  it("warns when graph and PFScript both output mouthX", () => {
    const behavior = compilePfScript("mouthX = interest * 0.4");
    const graphJson = JSON.stringify({
      nodes: [
        { id: "in", type: "stateInput", data: { key: "interest" } },
        { id: "out", type: "output", data: { key: "mouthX" } },
      ],
      edges: [{ id: "e1", source: "in", target: "out" }],
    });
    const warnings = findStatefulPluginConflicts("[]", behavior, graphJson);

    expect(warnings).toHaveLength(1);
    expect(formatStatefulPluginConflictWarning(warnings)).toContain("mouthX");
  });
});
