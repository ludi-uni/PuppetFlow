import { describe, expect, it, vi } from "vitest";
import { createProgram } from "./cli.js";

describe("pf motion commands", () => {
  it("parses record and replay options without changing run command inputs", async () => {
    const record = vi.fn(async () => {});
    const replay = vi.fn(async () => {});
    const run = vi.fn(async () => {});
    const program = createProgram({ run, record, replay });

    await program.parseAsync([
      "node",
      "pf",
      "record",
      "session.pfmotion",
      "--preset",
      "idle",
      "--state",
      "interest=0.8",
      "--duration",
      "120",
    ]);
    await program.parseAsync([
      "node",
      "pf",
      "replay",
      "session.pfmotion",
      "--speed",
      "1.5",
      "--loop",
      "--start-offset",
      "25",
      "--vmc-port",
      "39540",
    ]);
    await program.parseAsync(["node", "pf", "run", "--preset", "idle"]);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ output: "session.pfmotion", durationMs: 120 }),
    );
    expect(replay).toHaveBeenCalledWith(
      expect.objectContaining({
        input: "session.pfmotion",
        speed: 1.5,
        loop: true,
        startOffsetMs: 25,
        vmcPort: 39540,
      }),
    );
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ preset: "idle" }));
  });

  it("rejects invalid replay speed, offset, and port before invoking handlers", async () => {
    const replay = vi.fn(async () => {});
    const program = createProgram({
      run: vi.fn(async () => {}),
      record: vi.fn(async () => {}),
      replay,
    }).exitOverride();

    await expect(
      program.parseAsync(["node", "pf", "replay", "input.pfmotion", "--speed", "0"]),
    ).rejects.toThrow();
    await expect(
      program.parseAsync([
        "node",
        "pf",
        "replay",
        "input.pfmotion",
        "--start-offset",
        "-1",
      ]),
    ).rejects.toThrow();
    await expect(
      program.parseAsync([
        "node",
        "pf",
        "replay",
        "input.pfmotion",
        "--vmc-port",
        "70000",
      ]),
    ).rejects.toThrow();
    expect(replay).not.toHaveBeenCalled();
  });

  it("parses validate and compile input options without invoking runtime actions", async () => {
    const validate = vi.fn(async () => {});
    const compile = vi.fn(async () => {});
    const program = createProgram({
      run: vi.fn(async () => {}),
      record: vi.fn(async () => {}),
      replay: vi.fn(async () => {}),
      validate,
      compile,
    });

    await program.parseAsync(["node", "pf", "validate", "--config", "puppetflow.yaml"]);
    await program.parseAsync([
      "node",
      "pf",
      "compile",
      "--preset",
      "Curious",
      "--output",
      "dist/Curious.pfpreset",
    ]);

    expect(validate).toHaveBeenCalledWith({ configPath: "puppetflow.yaml" });
    expect(compile).toHaveBeenCalledWith({
      preset: "Curious",
      output: "dist/Curious.pfpreset",
    });
  });
});
