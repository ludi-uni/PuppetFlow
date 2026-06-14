import { describe, expect, it } from "vitest";
import { compilePfScript } from "./compile.js";
import { parsePfScript } from "./parser.js";

describe("pfscript-core", () => {
  it("compiles Motion Pack calls to Behavior MotionPack statements", () => {
    const behavior = compilePfScript("thinking(intensity = 0.8)");
    expect(behavior.statements[0]).toMatchObject({
      type: "MotionPack",
      packId: "thinking",
      config: { intensity: 0.8 },
    });
  });

  it("parses stateful oscillator expressions", () => {
    const program = parsePfScript(
      'bodyLean = oscillator(id = "body", frequency = 0.3) * 0.1 + 0.5',
    );
    expect(program.body).toHaveLength(1);
    expect(program.body[0]?.type).toBe("Assign");
  });

  it("rejects forbidden control-flow keywords", () => {
    expect(() => parsePfScript("while true do end")).toThrow(/Forbidden/);
  });
});
