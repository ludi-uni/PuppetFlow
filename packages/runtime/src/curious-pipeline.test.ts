import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mapMotion, VMC_PROFILE } from "@puppetflow/motion-mapper";
import { loadPreset } from "@puppetflow/preset";
import { describe, expect, it } from "vitest";
import { PuppetFlowRuntime } from "./runtime.js";

const CURIOUS_PRESET = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../behavior-packs/presets/Curious.pfpreset",
  ),
  "utf8",
);

describe("PuppetFlowRuntime", () => {
  it("runs Curious preset with PFScript mappings and idle wander", async () => {
    const runtime = new PuppetFlowRuntime().loadPreset(loadPreset(CURIOUS_PRESET));
    runtime.state.set("interest", 0.5);
    runtime.state.set("energy", 0.5);

    await runtime.start();

    expect(runtime.getTargetMotion().mouthX).toBeCloseTo(0.25, 2);
    expect(runtime.getTargetMotion().bodyYaw).toBeCloseTo(0.35, 2);

    runtime.state.set("interest", 0.2);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });

    const idleOutput = runtime
      .getPluginOutputs()
      .find((entry) => entry.pluginId === "idle")?.output;
    expect(idleOutput?.lookX).toBeDefined();
    expect(idleOutput?.lookX).not.toBe(0.5);

    const mapped = mapMotion(runtime.getTargetMotion(), VMC_PROFILE);
    expect(mapped.ParamMouthForm).toBeCloseTo(0.1, 2);

    await runtime.stop();
  });
});
