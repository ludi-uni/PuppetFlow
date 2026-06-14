import { describe, expect, it } from "vitest";
import type { BehaviorBlock } from "@puppetflow/behavior";
import {
  findStatefulPluginConflicts,
  formatStatefulPluginConflictWarning,
} from "./stateful-conflicts.js";

describe("stateful-conflicts", () => {
  it("warns when gaze plugin overlaps lookX assignment", () => {
    const behavior: BehaviorBlock = {
      type: "Block",
      statements: [
        {
          type: "ExprAssign",
          target: "lookX",
          value: { type: "Number", value: 0.5 },
        },
      ],
    };

    const warnings = findStatefulPluginConflicts(
      JSON.stringify([{ id: "gaze" }]),
      behavior,
    );

    expect(warnings).toHaveLength(1);
    expect(formatStatefulPluginConflictWarning(warnings)).toContain("gaze");
  });

  it("warns when blink plugin overlaps eyeYaw assignment", () => {
    const behavior: BehaviorBlock = {
      type: "Block",
      statements: [
        {
          type: "ExprAssign",
          target: "eyeYaw",
          value: { type: "Number", value: 0.8 },
        },
      ],
    };

    const warnings = findStatefulPluginConflicts(
      JSON.stringify([{ id: "blink" }]),
      behavior,
    );

    expect(warnings).toHaveLength(1);
    expect(formatStatefulPluginConflictWarning(warnings)).toContain("blink");
  });
});
