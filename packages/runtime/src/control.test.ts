import { describe, expect, it } from "vitest";

import { ActingEngine, type ActingBoneProfile } from "./acting/index.js";
import { createPuppetFlowControl } from "./control.js";
import { PuppetFlowRuntime } from "./runtime.js";

const PROFILE: ActingBoneProfile = {
  id: "control-test",
  bones: [{ name: "Head", position: { x: 0, y: 0, z: 0 } }],
};

describe("PuppetFlowControl", () => {
  it("delegates to the Runtime's existing ActingEngine while running", async () => {
    const engine = new ActingEngine({ profile: PROFILE, autoIdle: false });
    const runtime = new PuppetFlowRuntime().attachActingEngine(engine);
    const control = createPuppetFlowControl(runtime);

    await runtime.start();
    expect(control.act("wave").accepted).toBe(true);
    expect(engine.get_state().activeAction?.action).toBe("wave");
    expect(control.get_state()).toEqual(engine.get_state());
    await runtime.stop();
  });

  it("rejects operations and state queries while stopped or unavailable", () => {
    const stopped = createPuppetFlowControl(
      new PuppetFlowRuntime().attachActingEngine(
        new ActingEngine({ profile: PROFILE, autoIdle: false }),
      ),
    );
    const unavailable = createPuppetFlowControl(new PuppetFlowRuntime());

    expect(() => stopped.act("wave")).toThrow(/not running/i);
    expect(() => stopped.get_state()).toThrow(/not running/i);
    expect(() => unavailable.act("wave")).toThrow(/unavailable/i);
  });
});
