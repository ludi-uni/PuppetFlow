# PuppetFlow Expression Acting Support Design

**Date:** 2026-09-02

**Status:** Approved in chat; PuppetFlow-side implementation scope

## Goal

Add a procedural Expression lane to PuppetFlow Acting Runtime so semantic
expressions can run in parallel with Body Acting on the same runtime clock and
be emitted through the existing VMC output path. The expression implementation
must be generic: VRM/VMC-specific blendshape names belong to an injected profile,
not to the expression engine or semantic API.

The sibling `PuppetFlow_Acting_MCP` repository is owned by another agent in
this phase. This design changes only `D:\\99.AITuber\\PuppetFlow`; the MCP
repository will consume the resulting host API separately.

## Non-goals

- No LLM, Acting Planner, or MCP server changes in this repository.
- No STT, TTS, speech timing, phoneme timing, or Lip Sync engine.
- No automatic blink, gaze, breathing, Micro Behavior, face tracking, or
  multiple-emotion blending.
- No direct UDP/socket handling in the Expression Engine.
- No changes to existing Body Acting primitive names, scheduler semantics, or
  normal BlendShape ownership rules.

## Architecture

```text
Acting Runtime
├─ Body lane
│    └─ ActingScheduler → procedural bone offsets
│
└─ Expression lane
     └─ ExpressionEngine → semantic blendshape values

Both lanes
     ↓ same PuppetFlowRuntime tick
ActingEngine
     ↓ one MotionFrame { bones, blendShapes }
MotionFrameAdapter
     ↓ /VMC/Ext/Bone/Pos
     ↓ /VMC/Ext/Blend/Val + /VMC/Ext/Blend/Apply
Warudo / VMC receiver
```

`ActingEngine` remains the composition boundary. It owns a Body scheduler and
an optional Expression Engine, advances both synchronously from the
`deltaTime` supplied by `PuppetFlowRuntime`, and returns one normalized
`MotionFrame`. No expression timer or second runtime loop is introduced.

The existing runtime tick continues to update normal `Adapter` outputs first,
then dispatches the acting frame through the existing `MotionFrameAdapter`
pipeline. When a motion pipeline is attached, Body and Expression fields are
mixed through the existing per-domain mixer; without one, the acting frame is
sent directly as it is today.

## Semantic expression contract

The runtime defines this initial semantic catalogue:

```ts
type ActingExpressionName =
  | "neutral"
  | "happy"
  | "sad"
  | "angry"
  | "relaxed"
  | "surprised";

interface ActingExpressionParams {
  intensity?: number;
  duration?: number;
  fadeIn?: number;
  fadeOut?: number;
}

interface ActingExpressionRequest extends ActingExpressionParams {
  expression: ActingExpressionName | string;
}
```

The public runtime methods are synchronous and non-blocking:

```ts
interface ExpressionApi {
  set_expression(
    expression: ActingExpressionName | string,
    params?: ActingExpressionParams,
  ): ExpressionCommandResult;
  clear_expression(params?: { fadeOut?: number }): ExpressionCommandResult;
  get_expression_state(): ActingExpressionState;
}

interface ExpressionCommandResult {
  accepted: boolean;
  state: ActingExpressionState;
  reason?: string;
}
```

`ActingEngine` implements this API in addition to the existing Body API. Its
`set_expression` and `clear_expression` methods return the complete acting
state so Studio and a future MCP host can use one command/result contract.
`ActingScheduler` remains Body-only; it does not gain expression behavior.

Invalid semantic names, unavailable profile mappings, non-finite values, and
invalid timing are rejected without changing the current expression. The
command returns immediately; the runtime tick performs all subsequent motion.

## Profile boundary

The engine receives a profile through `ActingEngineOptions`:

```ts
interface ActingExpressionProfile {
  id: string;
  expressions: Partial<
    Record<
      ActingExpressionName,
      {
        blendShape: string;
      }
    >
  >;
}
```

`neutral` is always supported as the zero target. Non-neutral expressions are
accepted only when the selected profile provides a non-empty `blendShape`
mapping. The engine never invents a VRM name and never contains a character
specific mapping.

Studio supplies a separate default profile as model calibration data. The
current verified VRM mappings are:

```text
happy     → Warai
sad       → Sorrow
angry     → Angry
relaxed   → Fun
surprised → Hirameki
neutral   → zero expression-owned channels
```

The profile is replaceable for another VRM/VRM version. `Joy` is deliberately
not used for the current calibration because inspection of the supplied VRM
found no bind for that group.

## Expression state and interpolation

The initial implementation supports one active semantic expression at a time,
while keeping the state and profile shapes extensible for future mixing:

```ts
interface ActingExpressionState {
  activeExpression?: ActingExpressionRequest;
  activeExpressionId?: number;
  elapsed: number;
  remaining: number;
  fadeRemaining: number;
}
```

`set_expression` captures the current expression-owned values, resolves the
new semantic target through the profile, and transitions from the captured
values. A finite request follows:

```text
fade in → hold → fade out → zero
```

The default fade durations are 150ms in and 200ms out. Explicit fade values
are validated against the existing runtime timing policy; a finite duration
must leave room for both fades. When duration is omitted, the expression holds
until `clear_expression` or a replacement expression is accepted.

`clear_expression` transitions only the expression-owned channels to zero. It
does not touch mouth, blink, gaze, or any other channel outside the expression
profile. Replacing an expression captures the current interpolated values, so
there is no quaternion-style or blendshape-value jump.

The engine emits the complete set of expression-owned channel names while an
expression transition or hold is active. It emits one final zero frame when a
clear/finite fade completes, then may omit the expression domain until the next
expression command. This both clears the previous expression in VMC and avoids
continuous writes when the lane is idle.

## Body and Expression composition

Body interruption remains independent. `interrupt()` affects only the Body
lane; `clear_expression()` affects only the Expression lane. A Body `act()` or
Body `sequence()` does not implicitly change the expression. This supports
scenes such as `happy + wave`, `sad + wave`, and `neutral + wave` without
embedding expression side effects in Body primitives.

The existing Body `sequence()` schema remains backward compatible in this
phase. A caller can submit `set_expression()` and then `sequence()` without
waiting; both are accepted synchronously and advance on the same runtime
clock. A future typed multi-lane scene sequence can be added without changing
the primitive sampler.

## VMC adapter responsibilities

The Expression Engine produces semantic-resolved numeric values only. The
existing Node/Tauri VMC adapters remain the sole protocol boundary:

- `NodeOscAdapter.updateFrame` appends expression blendshape values to the
  existing bundle and adds `/VMC/Ext/Blend/Apply` after Blend/Val messages.
- `TauriOscAdapter.updateFrame` passes the same values to the existing Tauri
  command; the Rust sender appends Apply after the values.
- The normal legacy `update` path also sends Apply after its mapped Blend/Val
  values, preserving the existing mapping while making the packet sequence
  protocol-complete.
- Bone-only frames do not receive a spurious Blend/Apply message.

The VMC Blend/Apply message is emitted only when one or more blendshape values
are present. No Engine code imports `node:dgram`, opens a socket, or knows the
Warudo port.

## Runtime and public exports

The `@puppetflow/runtime` acting exports will add the Expression types,
`ExpressionEngine`, and the aggregate `ActingEngine` methods while preserving
existing Body exports. `PuppetFlowRuntime.getActingApi()` will expose the
aggregate API when an `ActingEngine` is attached, and `getActingState()` will
include the optional expression state without changing the no-engine empty
state contract.

Studio will attach the default expression profile when constructing its
existing ActingEngine and expose thin `setExpression` / `clearExpression`
wrappers for local verification. Any UI controls are submission-only; timing
and interpolation remain in the runtime.

## Testing strategy

Tests must be added before implementation for these behaviors:

1. Expression profile validation accepts only non-empty mappings and rejects
   unknown/unmapped semantic names.
2. `set_expression` returns immediately, applies intensity, and produces only
   profile-owned channel names.
3. Fade-in, hold, finite fade-out, continuous hold, replacement, and clear
   transitions are deterministic under supplied `deltaTime` values.
4. Expression output never clears unrelated mouth/blink channels.
5. Body and Expression appear in the same ActingEngine `MotionFrame` and use
   the same timestamp progression.
6. Body interrupt leaves the expression active; clear leaves Body active.
7. Node VMC bundles contain Blend/Val followed by Blend/Apply, while bone-only
   frames do not contain Apply.
8. Tauri payload names remain compatible with the existing Rust command and
   the Rust build passes.
9. Existing Body Acting, runtime dispatch, VMC mapping, and BlendShape tests
   remain green.
10. Studio profile and controls expose semantic names only; no VRM-specific
    name is part of the public command surface.

Live acceptance is separate from unit/protocol tests: with the existing
Warudo receiver, verify `happy + wave`, `surprised + recoil → look_right`,
`clear_expression`, and visible neutral recovery. An accepted command or a
captured UDP packet alone is not a visible Warudo acceptance claim.

## Risks and decisions

- The current supplied VRM is VRM0-style and uses case-sensitive group names;
  the profile keeps these names at the calibration boundary.
- `Joy` has no bind in the inspected model, so `Warai` is used for the current
  happy mapping. A different profile may select a different real group.
- Expression values are placed in `MotionFrame.blendShapes`, allowing the
  existing mixer and future Lip Sync lane to coexist without zeroing unknown
  keys.
- MCP tool registration is intentionally not part of this PuppetFlow change;
  the sibling MCP agent consumes the stable semantic API after this work.
