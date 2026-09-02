# PuppetFlow Expression Acting Support Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add a generic, profile-driven Expression lane to PuppetFlow Acting Runtime so semantic expressions and Body Acting share one runtime clock, one MotionFrame, and the existing VMC output path.

**Architecture:** Keep Body Acting in ActingScheduler and add a separate synchronous ExpressionEngine under @puppetflow/runtime/acting. ActingEngine composes both lanes into one normalized MotionFrame containing bones and expression-owned blendShapes; PuppetFlowRuntime continues to tick once and dispatch through existing adapters. Node/Tauri VMC adapters own /VMC/Ext/Blend/Val plus /VMC/Ext/Blend/Apply; semantic-to-VRM names are supplied by a replaceable profile.

**Tech Stack:** TypeScript, Vitest, React 19, Vite/Tauri 2, Rust rosc sender, pnpm 9.15.9, Node.js >=22, existing @puppetflow/core, @puppetflow/runtime, @puppetflow/adapter-vmc, and Warudo VMC receiver.

**Spec:** docs/superpowers/specs/2026-09-02-expression-acting-support-design.md

## Global Constraints

- Modify only D:/99.AITuber/PuppetFlow; do not modify D:/99.AITuber/PuppetFlow_Acting_MCP because another agent owns that repository.
- Preserve existing Body Acting primitives, scheduler timing, blend/interrupt behavior, normal BlendShape processing, and VMC Bone/Pos output.
- Expression commands are synchronous and non-blocking; all interpolation runs from the existing PuppetFlowRuntime deltaTime tick.
- Expose only semantic expression names (neutral, happy, sad, angry, relaxed, surprised) from the PuppetFlow API; VRM/VMC names remain inside replaceable profiles.
- Expression output may write only the channels declared by the active expression profile; never clear mouth, blink, gaze, or unknown channels.
- Finite expression requests follow fade-in, hold, fade-out, zero; omitted duration holds until clear_expression() or replacement.
- neutral is an implicit zero target and does not require a fabricated VRM blendshape name.
- /VMC/Ext/Blend/Apply must follow Blend/Val messages whenever a frame contains one or more blendshape values; Bone-only frames must not emit Apply.
- Keep all user-owned pre-existing preset/source changes unstaged and unmodified.
- Use TDD for every production change: write a failing test, run it, implement the smallest fix, rerun focused tests, then run broader checks.
- Keep protocol acceptance, runtime acceptance, and visible Warudo acceptance as separate evidence.

---

### Task 1: Add semantic Expression contracts and profile validation

**Files:**

- Modify: packages/runtime/src/acting/types.ts
- Modify: packages/runtime/src/acting/index.ts
- Modify: packages/runtime/src/index.ts
- Create: packages/runtime/src/acting/expression-profile.ts
- Test: packages/runtime/src/acting/expression-profile.test.ts

**Interfaces:**

- Produces ACTING_EXPRESSION_NAMES, ActingExpressionName, ActingExpressionParams, ActingExpressionRequest, ActingExpressionTarget, ActingExpressionProfile, ActingExpressionState, ExpressionCommandResult, ExpressionApi, and ActingRuntimeApi.
- Produces validateActingExpressionParams, validateActingExpressionProfile, resolveExpressionTarget, and expressionProfileChannels.
- Keeps the existing Body-only ActingApi and ActingScheduler contract intact; ActingRuntimeApi is the aggregate implemented by ActingEngine.

- [ ] Step 1: Write the failing contract/profile tests.

Add tests that use this exact profile and assertions:

```ts
const PROFILE: ActingExpressionProfile = {
  id: "test-expressions",
  expressions: {
    happy: { blendShape: "Joy" },
    sad: { blendShape: "Sorrow" },
  },
};

it("accepts neutral without a mapped blendshape and resolves mapped semantics", () => {
  expect(resolveExpressionTarget(PROFILE, "neutral")).toBeUndefined();
  expect(resolveExpressionTarget(PROFILE, "happy")).toEqual({
    blendShape: "Joy",
  });
  expect(expressionProfileChannels(PROFILE)).toEqual(["Joy", "Sorrow"]);
});

it("rejects unknown or unmapped expressions without inventing a channel", () => {
  expect(() => resolveExpressionTarget(PROFILE, "surprised")).toThrow(/mapping/i);
  expect(() => resolveExpressionTarget(PROFILE, "super_hyper_happy")).toThrow(
    /unknown/i,
  );
});

it("rejects empty profile mappings and invalid finite timing", () => {
  expect(() =>
    validateActingExpressionProfile({
      id: "bad",
      expressions: { happy: { blendShape: "" } },
    }),
  ).toThrow(/blendShape/i);
  expect(() => validateActingExpressionParams({ intensity: Infinity })).toThrow(
    /intensity/i,
  );
  expect(() => validateActingExpressionParams({ fadeIn: -0.01 })).toThrow(/fadeIn/i);
});
```

Validate intensity in 0..1, duration in 0.05..30 when present, and fadeIn/fadeOut in 0..30 when present. Do not put VRM names or character mappings in this module.

- [ ] Step 2: Run the focused tests and verify the intended RED failure.

Run:

```powershell
pnpm exec vitest run packages/runtime/src/acting/expression-profile.test.ts
```

Expected: FAIL because the expression contracts and profile resolver do not exist yet. A module-resolution or syntax error is not an acceptable RED result; correct imports until the failure names the missing behavior.

- [ ] Step 3: Implement the contracts and profile resolver.

Add this public contract to types.ts while leaving existing Body types compatible:

```ts
export const ACTING_EXPRESSION_NAMES = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "relaxed",
  "surprised",
] as const;

export type ActingExpressionName = (typeof ACTING_EXPRESSION_NAMES)[number];

export interface ActingExpressionParams {
  intensity?: number;
  duration?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface ActingExpressionRequest extends ActingExpressionParams {
  expression: ActingExpressionName | string;
}

export interface ActingExpressionTarget {
  blendShape: string;
}

export interface ActingExpressionProfile {
  id: string;
  expressions: Partial<Record<ActingExpressionName, ActingExpressionTarget>>;
}

export interface ActingExpressionState {
  activeExpression?: ActingExpressionRequest;
  activeExpressionId?: number;
  elapsed: number;
  remaining: number;
  fadeRemaining: number;
}

export interface ExpressionCommandResult {
  accepted: boolean;
  state: ActingExpressionState;
  reason?: string;
}

export interface ExpressionApi {
  set_expression(
    expression: ActingExpressionName | string,
    params?: ActingExpressionParams,
  ): ExpressionCommandResult;
  clear_expression(params?: { fadeOut?: number }): ExpressionCommandResult;
  get_expression_state(): ActingExpressionState;
}

export interface ActingRuntimeApi extends ActingApi, ExpressionApi {}
```

Extend ActingState with expression?: ActingExpressionState. Treat neutral as the implicit zero target. Require a non-empty profile mapping for non-neutral semantic names. Export the new contracts and resolver from both acting/index.ts and the runtime package root.

- [ ] Step 4: Run focused tests and public export checks.

Run:

```powershell
pnpm exec vitest run packages/runtime/src/acting/expression-profile.test.ts
pnpm --filter @puppetflow/runtime build
```

Expected: focused tests pass, the runtime package builds, and new types/functions are available from @puppetflow/runtime without removing existing exports.

- [ ] Step 5: Commit the contract boundary.

```powershell
git add packages/runtime/src/acting/types.ts packages/runtime/src/acting/index.ts packages/runtime/src/index.ts packages/runtime/src/acting/expression-profile.ts packages/runtime/src/acting/expression-profile.test.ts
git commit -m "feat(runtime): add semantic expression contracts"
```

---

### Task 2: Implement the synchronous ExpressionEngine lane

**Files:**

- Create: packages/runtime/src/acting/expression-engine.ts
- Test: packages/runtime/src/acting/expression-engine.test.ts
- Modify: packages/runtime/src/acting/index.ts

**Interfaces:**

- Consumes Task 1 expression profile and API contracts.
- Produces ExpressionEngine with set_expression, clear_expression, get_expression_state, reset, and tick(deltaTime): Record<string, number>.
- tick returns only profile channels and never returns mouth/blink/lip-sync keys unless a future profile explicitly owns them.

- [ ] Step 1: Write the failing engine tests.

Use this exact deterministic profile and behavior assertions:

```ts
const PROFILE: ActingExpressionProfile = {
  id: "test-expressions",
  expressions: {
    happy: { blendShape: "Joy" },
    sad: { blendShape: "Sorrow" },
  },
};

it("accepts set_expression immediately and does not wait for duration", () => {
  const engine = new ExpressionEngine({ profile: PROFILE });
  const result = engine.set_expression("happy", {
    intensity: 0.6,
    duration: 1.5,
    fadeIn: 0.15,
    fadeOut: 0.2,
  });

  expect(result.accepted).toBe(true);
  expect(result.state.activeExpression).toMatchObject({ expression: "happy" });
  expect(result.state.remaining).toBe(1.5);
});

it("fades in, holds, fades out, and emits a zero endpoint", () => {
  const engine = new ExpressionEngine({ profile: PROFILE });
  engine.set_expression("happy", {
    intensity: 0.6,
    duration: 1.5,
    fadeIn: 0.15,
    fadeOut: 0.2,
  });

  expect(engine.tick(0.075).Joy).toBeCloseTo(0.3, 2);
  expect(engine.tick(0.075).Joy).toBeCloseTo(0.6, 2);
  expect(engine.tick(1.0).Joy).toBeCloseTo(0.6, 2);
  expect(engine.tick(0.1).Joy).toBeGreaterThan(0);
  expect(engine.tick(0.25)).toEqual({ Joy: 0, Sorrow: 0 });
  expect(engine.get_expression_state().activeExpression).toBeUndefined();
});

it("holds an omitted-duration expression until clear_expression", () => {
  const engine = new ExpressionEngine({ profile: PROFILE });
  engine.set_expression("sad", { intensity: 0.4, fadeIn: 0 });
  engine.tick(10);

  expect(engine.get_expression_state().remaining).toBe(Infinity);
  expect(engine.clear_expression({ fadeOut: 0.2 }).accepted).toBe(true);
  expect(engine.tick(0.2)).toEqual({ Joy: 0, Sorrow: 0 });
});

it("replaces from currently interpolated values and preserves owned channels only", () => {
  const engine = new ExpressionEngine({ profile: PROFILE });
  engine.set_expression("happy", { intensity: 0.6, fadeIn: 0 });
  const current = engine.tick(0.1);
  engine.set_expression("sad", { intensity: 0.4, fadeIn: 0.15 });

  expect(engine.tick(0).Joy).toBeCloseTo(current.Joy);
  expect(Object.keys(engine.tick(0))).toEqual(["Joy", "Sorrow"]);
});

it("rejects invalid expressions without changing active expression", () => {
  const engine = new ExpressionEngine({ profile: PROFILE });
  engine.set_expression("happy", { intensity: 0.5, fadeIn: 0 });
  const before = engine.get_expression_state();

  const result = engine.set_expression("surprised", { intensity: 0.5 });

  expect(result.accepted).toBe(false);
  expect(engine.get_expression_state()).toEqual(before);
});
```

Use default fadeIn=0.15 and fadeOut=0.2. Reject finite duration shorter than fadeIn + fadeOut. The implementation must not call setTimeout, setInterval, sleep, or any socket API.

- [ ] Step 2: Run the tests to verify the missing-engine RED result.

Run:

```powershell
pnpm exec vitest run packages/runtime/src/acting/expression-engine.test.ts
```

Expected: FAIL because ExpressionEngine is not implemented. Keep the failure at the behavior boundary rather than accepting a module-resolution error.

- [ ] Step 3: Implement the minimal lane.

Use:

```ts
interface ExpressionEngineOptions {
  profile: ActingExpressionProfile;
  defaultFadeIn?: number;
  defaultFadeOut?: number;
}
```

Store a complete numeric record for every profile channel. On set_expression, capture current values, resolve the semantic target (all zero except the selected mapped channel), and start a transition. On clear_expression, transition to all zeros using only fadeOut. A finite request performs fade-in, hold, and fade-out; omitted duration remains active indefinitely. Set dirty=true initially and after clear so the first/last zero record is emitted, then return {} when neutral and idle. Clone records at API and tick boundaries.

- [ ] Step 4: Run focused engine tests and export checks.

Run:

```powershell
pnpm exec vitest run packages/runtime/src/acting/expression-engine.test.ts packages/runtime/src/acting/expression-profile.test.ts
pnpm --filter @puppetflow/runtime build
```

Expected: all ExpressionEngine tests pass and the runtime package contains the public ExpressionEngine export.

- [ ] Step 5: Commit the Expression lane.

```powershell
git add packages/runtime/src/acting/expression-engine.ts packages/runtime/src/acting/expression-engine.test.ts packages/runtime/src/acting/index.ts
git commit -m "feat(runtime): add expression acting lane"
```

---

### Task 3: Compose Body and Expression on the existing runtime clock

**Files:**

- Modify: packages/runtime/src/acting/engine.ts
- Modify: packages/runtime/src/acting/engine.test.ts
- Modify: packages/runtime/src/runtime.ts
- Modify: packages/runtime/src/runtime.test.ts

**Interfaces:**

- ActingEngineOptions gains optional expressionProfile?: ActingExpressionProfile.
- ActingEngine implements ActingRuntimeApi; Body methods keep current signatures and Expression methods return an ActingCommandResult with nested state.expression.
- ActingEngine.tick returns one MotionFrame with existing bones plus blendShapes when the Expression lane has output.
- PuppetFlowRuntime.getActingApi returns ActingRuntimeApi | null; no-engine empty state remains unchanged.

- [ ] Step 1: Write failing composition and independence tests.

Add this profile and tests to engine.test.ts:

```ts
const EXPRESSION_PROFILE: ActingExpressionProfile = {
  id: "engine-expressions",
  expressions: { happy: { blendShape: "Joy" } },
};

it("emits Body bones and Expression blendshapes in one frame with one clock", () => {
  const engine = new ActingEngine({
    profile: PROFILE,
    expressionProfile: EXPRESSION_PROFILE,
  });
  engine.act("wave", { duration: 1 });
  engine.set_expression("happy", { intensity: 0.5, fadeIn: 0 });

  const frame = engine.tick(0.1, createEmptyMotionState());

  expect(frame.timestamp).toBe(100);
  expect(frame.bones?.RightUpperArm).toBeDefined();
  expect(frame.blendShapes).toEqual({ Joy: 0.5 });
});

it("keeps Expression active when Body is interrupted and keeps Body active when Expression clears", () => {
  const engine = new ActingEngine({
    profile: PROFILE,
    expressionProfile: EXPRESSION_PROFILE,
  });
  engine.act("wave", { duration: 1 });
  engine.set_expression("happy", { intensity: 0.5, fadeIn: 0 });

  engine.interrupt();
  expect(engine.get_state().expression?.activeExpression?.expression).toBe("happy");

  engine.act("bow", { duration: 1 });
  engine.clear_expression({ fadeOut: 0 });
  expect(engine.get_state().activeAction?.action).toBe("bow");
});

it("rejects Expression commands when no profile is configured", () => {
  const engine = new ActingEngine({ profile: PROFILE });
  const result = engine.set_expression("happy");

  expect(result.accepted).toBe(false);
  expect(result.reason).toMatch(/profile/i);
});
```

Add runtime tests that an attached engine dispatches one frame containing both bones and blendShapes and that stopping resets both lanes. Keep existing Body-only tests unchanged except type imports.

- [ ] Step 2: Run the focused tests to verify RED.

Run:

```powershell
pnpm exec vitest run packages/runtime/src/acting/engine.test.ts packages/runtime/src/runtime.test.ts
```

Expected: the new assertions fail because ActingEngine has no Expression profile, methods, or blendshape composition.

- [ ] Step 3: Implement aggregate ActingEngine methods and frame composition.

Instantiate ExpressionEngine only when options.expressionProfile is present. Delegate set_expression, clear_expression, and get_expression_state; wrap Expression results with the Body state for ActingCommandResult. get_state returns Body state plus a cloned expression state. reset resets both engines without moving the existing monotonic timestamp backward.

In tick, call Body and Expression exactly once with the same deltaTime and add the expression record only when non-empty:

```ts
const expressionValues = this.expressionEngine?.tick(deltaTime);
return normalizeMotionFrame({
  timestamp: this.timestamp,
  bones,
  ...(expressionValues && Object.keys(expressionValues).length > 0
    ? { blendShapes: expressionValues }
    : {}),
  metadata: existingActingMetadata,
});
```

Update PuppetFlowRuntime types only as needed. The existing tick already calls ActingEngine.tick(deltaTime, renderedMotion); do not add another timer or dispatch path.

- [ ] Step 4: Run focused runtime tests and confirm Body regression.

Run:

```powershell
pnpm exec vitest run packages/runtime/src/acting/engine.test.ts packages/runtime/src/acting/expression-engine.test.ts packages/runtime/src/runtime.test.ts
```

Expected: new composition/independence tests and existing runtime tests pass, with Body-only ActingEngine instances still producing no expression field.

- [ ] Step 5: Commit same-clock composition.

```powershell
git add packages/runtime/src/acting/engine.ts packages/runtime/src/acting/engine.test.ts packages/runtime/src/runtime.ts packages/runtime/src/runtime.test.ts
git commit -m "feat(runtime): compose body and expression acting"
```

---

### Task 4: Complete VMC Blend/Apply output without disturbing existing channels

**Files:**

- Modify: packages/adapter-vmc/src/osc-encoder.ts
- Modify: packages/adapter-vmc/src/osc-encoder.test.ts
- Modify: packages/adapter-vmc/src/node-osc-adapter.ts
- Modify: packages/adapter-vmc/src/node-osc-adapter.test.ts
- Modify: packages/adapter-vmc/src/index.ts
- Modify: packages/adapter-vmc/src/tauri-osc-adapter.test.ts
- Modify: apps/studio/src-tauri/src/lib.rs

**Interfaces:**

- Produces encodeBlendShapeApplyMessage(): Uint8Array for /VMC/Ext/Blend/Apply with no arguments.
- Node and Tauri adapters append Apply only after one or more Blend/Val values; normal mapped BlendShape output and MotionFrame values both use the rule.
- Existing Tauri command names and payload keys remain unchanged; only encoded OSC content gains the final Apply message.

- [ ] Step 1: Write failing OSC and adapter tests.

Add:

```ts
it("encodes a zero-argument VMC Blend/Apply message", () => {
  const packet = encodeBlendShapeApplyMessage();
  expect(new TextDecoder().decode(packet)).toContain("/VMC/Ext/Blend/Apply");
  expect(new TextDecoder().decode(packet)).toContain(",");
});
```

Extend the Node bundle test with an ordered OSC address decoder and assert:

```ts
expect(addresses).toEqual([
  "/VMC/Ext/Bone/Pos",
  "/VMC/Ext/Blend/Val",
  "/VMC/Ext/Blend/Apply",
]);
```

Add a Bone-only frame test asserting Apply is absent. Add a normal update() case asserting Apply is last after all mapped Blend/Val packets. Keep the Tauri invoke payload test and add expression-bearing frame coverage without changing camelCase keys.

- [ ] Step 2: Run adapter tests and verify RED.

Run:

```powershell
pnpm exec vitest run packages/adapter-vmc/src/osc-encoder.test.ts packages/adapter-vmc/src/node-osc-adapter.test.ts packages/adapter-vmc/src/tauri-osc-adapter.test.ts
```

Expected: FAIL because the encoder and adapter Apply behavior do not exist.

- [ ] Step 3: Implement Node encoder and Apply ordering.

Encode Apply with address /VMC/Ext/Blend/Apply and type tag comma, and export it from packages/adapter-vmc/src/index.ts. In NodeOscAdapter.updateFrame, track whether any blendShapes or mapped parameter values were appended; append Apply after those values and before sending the bundle. In update, append one Apply after all mapped values when the map is non-empty. Do not append Apply for bone-only or empty frames.

- [ ] Step 4: Implement Tauri/Rust sender ordering.

In apps/studio/src-tauri/src/lib.rs, capture has_blend_shapes before consuming each map, append an OSC message with address /VMC/Ext/Blend/Apply after all /VMC/Ext/Blend/Val messages, and leave Bone/Pos messages and command arguments unchanged. Do the same for osc_send_blend_params. Use the existing socket and rosc encoder only.

- [ ] Step 5: Run focused tests and Rust/Tauri compilation.

Run:

```powershell
pnpm exec vitest run packages/adapter-vmc/src/osc-encoder.test.ts packages/adapter-vmc/src/node-osc-adapter.test.ts packages/adapter-vmc/src/tauri-osc-adapter.test.ts packages/adapter-vmc/src/node-vmc-adapter.test.ts
pnpm --filter @puppetflow/adapter-vmc build
pnpm --filter @puppetflow/runtime build
pnpm --filter @puppetflow/studio exec tauri build --no-bundle
```

Expected: focused adapter tests pass, package builds pass, and the Tauri Rust build compiles the new Apply sender.

- [ ] Step 6: Commit the VMC protocol boundary.

```powershell
git add packages/adapter-vmc/src/osc-encoder.ts packages/adapter-vmc/src/osc-encoder.test.ts packages/adapter-vmc/src/node-osc-adapter.ts packages/adapter-vmc/src/node-osc-adapter.test.ts packages/adapter-vmc/src/index.ts packages/adapter-vmc/src/tauri-osc-adapter.test.ts apps/studio/src-tauri/src/lib.rs
git commit -m "feat(vmc): apply expression blendshapes"
```

---

### Task 5: Supply the default profile and Studio-facing Expression controls

**Files:**

- Create: apps/studio/src/acting/default-expression-profile.ts
- Create: apps/studio/src/acting/default-expression-profile.test.ts
- Modify: apps/studio/src/runtime.ts
- Modify: apps/studio/src/runtime.test.ts
- Modify: apps/studio/src/hooks/useActing.ts
- Modify: apps/studio/src/hooks/useActing.test.ts
- Modify: apps/studio/src/features/shared/tabs/ActingTab.tsx
- Modify: apps/studio/src/features/shared/tabs/ActingTab.test.tsx

**Interfaces:**

- Produces DEFAULT_EXPRESSION_PROFILE with current model calibration only at the Studio boundary.
- Studio constructs ActingEngine with both DEFAULT_ACTING_BONE_PROFILE and DEFAULT_EXPRESSION_PROFILE.
- Studio exports synchronous setExpression and clearExpression wrappers; the hook and tab submit commands only.

- [ ] Step 1: Write failing profile, wrapper, hook, and UI tests.

Add this exact profile assertion:

```ts
expect(DEFAULT_EXPRESSION_PROFILE).toEqual({
  id: "default-vrm-expression",
  expressions: {
    happy: { blendShape: "Warai" },
    sad: { blendShape: "Sorrow" },
    angry: { blendShape: "Angry" },
    relaxed: { blendShape: "Fun" },
    surprised: { blendShape: "Hirameki" },
  },
});
```

Extend the runtime test to assert the constructed ActingEngine has an expression API. Extend useActing mocks and add:

```ts
it("forwards expression commands and applies returned state immediately", async () => {
  const nextState = {
    ...initialState,
    expression: {
      activeExpression: { expression: "happy", intensity: 0.5 },
      elapsed: 0,
      remaining: 1.5,
      fadeRemaining: 0.15,
    },
  };
  vi.mocked(runtimeSetExpression).mockReturnValue(result(nextState));

  await renderHook();
  act(() => current?.setExpression("happy", { intensity: 0.5, duration: 1.5 }));

  expect(runtimeSetExpression).toHaveBeenCalledWith("happy", {
    intensity: 0.5,
    duration: 1.5,
  });
  expect(current?.state).toEqual(nextState);
});
```

Extend ActingTab.test.tsx to assert semantic expression buttons are present, the clear button calls clearExpression, and the tab never displays a VRM-specific channel name such as Warai or Sorrow.

- [ ] Step 2: Run focused Studio tests and verify RED.

Run:

```powershell
pnpm exec vitest run apps/studio/src/acting/default-expression-profile.test.ts apps/studio/src/runtime.test.ts apps/studio/src/hooks/useActing.test.ts
pnpm exec vitest run --config vite.config.ts src/features/shared/tabs/ActingTab.test.tsx
```

The second command must run from D:/99.AITuber/PuppetFlow/apps/studio. Expected: FAIL because the profile, wrappers, hook methods, and UI controls do not exist.

- [ ] Step 3: Add the replaceable default profile.

Create DEFAULT_EXPRESSION_PROFILE with only the verified real group names above. Keep its ID generic and document that it is calibration data to replace for another VRM. Do not import this profile into ExpressionEngine or the semantic runtime package.

- [ ] Step 4: Attach the profile and expose thin Studio wrappers.

Update apps/studio/src/runtime.ts to pass the profile during runtime construction and add:

```ts
export function setExpression(
  expression: ActingExpressionName | string,
  params?: ActingExpressionParams,
): ActingCommandResult {
  return getActingApi().set_expression(expression, params);
}

export function clearExpression(params?: { fadeOut?: number }): ActingCommandResult {
  return getActingApi().clear_expression(params);
}
```

Update UseActingResult and useActing to route both commands through runCommand, preserving immediate state and error handling.

- [ ] Step 5: Add semantic-only ActingTab controls.

Add a separate Expression section with buttons for neutral, happy, sad, angry, relaxed, and surprised; numeric controls for expression-intensity, expression-duration, expression-fade-in, and expression-fade-out; and a clear expression button. Each expression button calls setExpression with semantic names and numeric parameters; clear calls clearExpression({ fadeOut }). Keep Body controls and the existing acceptance sequence unchanged. Render nested expression state as status only; never render or accept a VRM BlendShape name.

- [ ] Step 6: Run focused Studio checks.

Run:

```powershell
pnpm exec vitest run apps/studio/src/acting/default-expression-profile.test.ts apps/studio/src/runtime.test.ts apps/studio/src/hooks/useActing.test.ts
pnpm exec vitest run --config vite.config.ts src/features/shared/tabs/ActingTab.test.tsx
pnpm --filter @puppetflow/studio exec tsc --noEmit --pretty false
```

Expected: profile, wrapper, hook, UI, and Studio type checks pass.

- [ ] Step 7: Commit Studio integration.

```powershell
git add apps/studio/src/acting/default-expression-profile.ts apps/studio/src/acting/default-expression-profile.test.ts apps/studio/src/runtime.ts apps/studio/src/runtime.test.ts apps/studio/src/hooks/useActing.ts apps/studio/src/hooks/useActing.test.ts apps/studio/src/features/shared/tabs/ActingTab.tsx apps/studio/src/features/shared/tabs/ActingTab.test.tsx
git commit -m "feat(studio): expose semantic expression acting"
```

---

### Task 6: Full PuppetFlow verification and Warudo acceptance

**Files:**

- Modify: .superpowers/sdd/2026-09-02-expression-acting-support/progress.md (gitignored ledger only)
- Create outside Git: C:/Users/leade/Downloads/puppetflow-studio-windows-x64-0.1.20-portable/puppetflow-studio-expression-vmc.exe when the existing portable executable is locked
- Do not modify: D:/99.AITuber/PuppetFlow_Acting_MCP

**Interfaces:**

- Consumes the built PuppetFlow runtime, Studio default profiles, Tauri sender, existing VMC port 127.0.0.1:39539, and Warudo receiver.
- Produces separate evidence for tests/build, OSC Apply ordering, runtime state, and visible Warudo Body+Expression behavior.

- [ ] Step 1: Resolve the SDD ledger and record the verification baseline.

Run the SDD workspace helper and create the plan-owned ledger:

```powershell
node C:/Users/leade/.codex/plugins/cache/openai-curated-remote/superpowers/6.3.0/skills/subagent-driven-development/scripts/sdd-workspace D:/99.AITuber/PuppetFlow/docs/superpowers/plans/2026-09-02-expression-acting-support.md
```

The ledger first line must identify this plan. Record the current commit, preserved user-owned dirty paths, and the fact that the MCP sibling is outside this plan.

- [ ] Step 2: Run complete mechanical verification.

Run and wait for final exit codes:

```powershell
pnpm test
pnpm lint
pnpm typecheck:apps
pnpm build
pnpm exec prettier --check packages/runtime/src/acting packages/runtime/src/runtime.ts packages/adapter-vmc/src apps/studio/src/acting apps/studio/src/hooks/useActing.ts apps/studio/src/features/shared/tabs/ActingTab.tsx
git -c safe.directory=D:/99.AITuber/PuppetFlow -C D:/99.AITuber/PuppetFlow diff --check
```

Run the Studio JSX test separately from the Studio package directory:

```powershell
pnpm exec vitest run --config vite.config.ts src/features/shared/tabs/ActingTab.test.tsx
```

Expected: Body and Expression tests pass; lint, typecheck, build, feature formatting, and diff checks pass.

- [ ] Step 3: Build and stage the portable Windows executable.

Run:

```powershell
pnpm --filter @puppetflow/studio exec tauri build --no-bundle
Copy-Item -LiteralPath D:/99.AITuber/PuppetFlow/apps/studio/src-tauri/target/release/puppetflow-studio.exe -Destination C:/Users/leade/Downloads/puppetflow-studio-windows-x64-0.1.20-portable/puppetflow-studio-expression-vmc.exe
Get-FileHash -Algorithm SHA256 -LiteralPath D:/99.AITuber/PuppetFlow/apps/studio/src-tauri/target/release/puppetflow-studio.exe,C:/Users/leade/Downloads/puppetflow-studio-windows-x64-0.1.20-portable/puppetflow-studio-expression-vmc.exe
```

Do not overwrite or terminate a locked user process. If the destination exists, resolve it read-only and choose a new distinct filename.

- [ ] Step 4: Run live Body + Expression acceptance in Warudo.

Before UI actions, list and select exactly one fresh Studio window and the existing Warudo window through Computer Use. Confirm no second Studio process sends to port 39539. Launch the staged executable if needed, select Acting, and run:

```text
set expression happy intensity=0.5 duration=1.5 fadeIn=0.15 fadeOut=0.2
start body wave in parallel
→ face remains happy while the arm waves
→ after 1.5s expression returns to neutral without clearing mouth/blink

set expression surprised intensity=0.5 duration=1.2
sequence(recoil duration=0.3, look_right duration=0.4)
→ surprise and body reaction overlap on the same runtime clock

set expression happy intensity=0.5
clear expression fadeOut=0.2
→ only expression-owned channels fade to zero; body state remains independent
```

Capture Acting state and Warudo screenshots at active, fade-out, and neutral endpoints. Protocol or accepted-command evidence alone is not visible acceptance. If a mapping is not visually distinguishable, record the exact result rather than inventing a name.

- [ ] Step 5: Review the complete diff and preservation boundary.

Run:

```powershell
git status --short --branch
git log --oneline -12
rg -n "node:dgram|setTimeout|setInterval|Joy|Warai|Sorrow|Angry|Fun|Hirameki|Mouth|Blink" packages/runtime/src/acting apps/studio/src/acting apps/studio/src/features/shared/tabs/ActingTab.tsx
git -c safe.directory=D:/99.AITuber/PuppetFlow -C D:/99.AITuber/PuppetFlow diff --check
```

Confirm socket/timer imports exist only in adapter/runtime boundaries, VRM names occur only in the default profile and adapter tests, expression code does not write unrelated channels, and pre-existing preset changes remain untouched and unstaged.

- [ ] Step 6: Commit only verified PuppetFlow source/evidence changes.

```powershell
git add packages/runtime/src packages/adapter-vmc/src apps/studio/src apps/studio/src-tauri/src/lib.rs docs/superpowers/plans/2026-09-02-expression-acting-support.md
git diff --cached --name-only
git commit -m "feat: add expression acting runtime support"
```

Before staging, remove any user-owned preset paths from the index if they were accidentally included. The portable executable remains an external staged artifact and is not committed to this repository.
