import { describe, expect, it } from "vitest";
import { statefulBlockToStatements } from "./stateful-blocks.js";

describe("statefulBlockToStatements", () => {
  it("builds smooth ExprAssign with state identifier", () => {
    const block = {
      type: "pf_stateful_smooth",
      getFieldValue: (name: string) => {
        if (name === "TARGET") return "bodyLean";
        if (name === "SOURCE") return "interest";
        if (name === "SPEED") return 2;
        return "";
      },
    };

    const statements = statefulBlockToStatements(block as never);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatchObject({
      type: "ExprAssign",
      target: "bodyLean",
      value: {
        type: "Call",
        callee: "smooth",
      },
    });
    const call = (
      statements[0] as {
        value: { args: Array<{ name?: string; value: { type: string } }> };
      }
    ).value;
    const valueArg = call.args.find((arg) => arg.name === "value");
    expect(valueArg?.value).toEqual({ type: "Identifier", name: "interest" });
  });

  it("builds wander gaze as lookX and lookY assignments", () => {
    const block = {
      type: "pf_stateful_wander_gaze",
      getFieldValue: (name: string) => {
        if (name === "SPEED") return 0.3;
        if (name === "AMPLITUDE") return 0.15;
        return "";
      },
    };

    const statements = statefulBlockToStatements(block as never);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toMatchObject({ type: "ExprAssign", target: "lookX" });
    expect(statements[1]).toMatchObject({ type: "ExprAssign", target: "lookY" });
  });

  it("builds blink ExprAssign for eyeYaw", () => {
    const block = {
      type: "pf_stateful_blink",
      getFieldValue: (name: string) => {
        if (name === "INTERVAL") return 4;
        if (name === "STRENGTH") return 0.2;
        return "";
      },
    };

    const statements = statefulBlockToStatements(block as never);
    expect(statements[0]).toMatchObject({
      type: "ExprAssign",
      target: "eyeYaw",
      value: { type: "Binary", op: "-" },
    });
  });
});
