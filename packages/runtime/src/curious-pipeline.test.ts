import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mapMotion, VMC_PROFILE } from "@puppetflow/motion-mapper";
import { loadPreset } from "@puppetflow/preset";
import { describe, expect, it } from "vitest";
import { PuppetFlowRuntime } from "./runtime.js";

const CURIOUS_PRESET = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../behavior-packs/presets/Curious.pfpreset"),
  "utf8",
);

describe("PuppetFlowRuntime", () => {
  it("runs Curious preset with stable head tilt at neutral interest", async () => {
    const runtime = new PuppetFlowRuntime().loadPreset(loadPreset(CURIOUS_PRESET));
    runtime.state.set("interest", 0.5);
    runtime.state.set("energy", 0.5);

    await runtime.start();

    expect(runtime.getTargetMotion().headTilt).toBeCloseTo(0.5, 2);

    const gazeOutput = runtime
      .getPluginOutputs()
      .find((entry) => entry.pluginId === "gaze")?.output;
    expect(gazeOutput?.lookX).toBeDefined();
    expect(gazeOutput?.lookX).not.toBe(0.5);

    const mapped = mapMotion(runtime.getTargetMotion(), VMC_PROFILE);
    expect(mapped.ParamAngleZ).toBeCloseTo(0, 2);

    await runtime.stop();
  });
});
