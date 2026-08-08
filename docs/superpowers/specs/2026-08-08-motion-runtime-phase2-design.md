# PuppetFlow Motion Runtime Phase 2 Design

## Goal

Add an opt-in, protocol-independent frame processing path for source filtering, multi-source mixing, and skeleton retargeting while preserving the Phase 1 raw `MotionFrame` path and all legacy `MotionState` APIs.

## Scope

Phase 2 includes:

- source and output filter chains with deadzone, clamp, and stateful low-pass filters;
- priority/weight based motion mixing with bone, blendShape, and parameter masks;
- bone mapping, quaternion rotation offsets, position offsets, and uniform scale retargeting;
- a runtime attachment point that processes all available source frames before frame-capable adapters;
- pure unit tests, runtime integration tests, documentation, and a no-hardware multi-source example.

Phase 2 excludes YAML/CLI configuration wiring, fail-safe behavior, Inspector, Motion Graph canonical integration, Plugin API expansion, VMC protocol validation, UDP interoperability, and GUI work. The public processing API is intentionally usable from TypeScript first; configuration serialization can be added without changing the processing contracts.

## Design

### Package boundary

Create `@puppetflow/motion-pipeline` with no Node or transport dependency. It consumes and produces `MotionFrame` values from `@puppetflow/core` and exports:

```ts
interface MotionFrameInput {
  sourceId: string;
  frame: MotionFrame;
}

interface MotionLayer {
  source: string;
  priority: number;
  weight?: number;
  bones?: readonly BoneId[];
  blendShapes?: readonly string[];
  parameters?: readonly string[];
}

interface MotionFrameFilter {
  readonly id: string;
  apply(frame: MotionFrame, deltaTime: number): MotionFrame;
  reset(): void;
}

interface MotionFramePipeline {
  process(
    inputs: readonly MotionFrameInput[],
    deltaTime: number,
  ): MotionFrame | undefined;
  reset(): void;
}
```

`createMotionFramePipeline` composes source filters, a mixer, retargeting, and output filters. The pipeline owns stateful filter instances and is reset when Runtime stops.

### Mixer semantics

Each source frame is assigned a layer by `sourceId`. A missing layer uses priority `0` and weight `1` so the pipeline remains useful with a single source. For each bone transform component and numeric channel, only the highest-priority eligible candidates participate. Candidates at that priority are weighted by `weight`; a weight of zero contributes nothing. Masks are component-domain masks, so a layer may own the head while another owns body bones and blendShapes.

Positions and scales use weighted arithmetic means. Quaternions use hemisphere-corrected normalized linear interpolation, avoiding Euler-angle interpolation and preserving the shortest orientation direction. Partial transforms remain partial: a missing position, rotation, or scale is never synthesized.

The mixed frame uses the greatest input timestamp, carries a mixer metadata source type, and records contributing source IDs. Empty input produces `undefined`.

### Retarget semantics

`MotionRetargetProfile` maps input bone IDs to output IDs and optionally applies per-input-bone transforms:

```ts
interface MotionRetargetProfile {
  mapping?: Readonly<Record<BoneId, BoneId>>;
  bones?: Readonly<
    Record<
      BoneId,
      {
        rotationOffset?: Quaternion;
        positionOffset?: Vec3;
        scale?: number;
      }
    >
  >;
}
```

Rotation offsets are quaternion-multiplied on the input rotation, position offsets are added after optional uniform scaling, and an absent mapping keeps the original bone ID. Unknown bones remain safe and are retained unless explicitly mapped.

### Filters

Filters operate on numeric `blendShapes` and `parameters`, and on position/rotation/scale components for selected bones. Masks are optional; an omitted mask applies to the relevant domain. `createDeadzoneFilter` zeroes values inside a symmetric deadzone, `createClampFilter` bounds numeric values, and `createLowPassFilter` uses a configurable alpha with quaternion nlerp for rotations. Low-pass state is keyed by channel and bone/component and is reset between runtime sessions.

### Runtime integration

`PuppetFlowRuntime.attachMotionPipeline(pipeline)` is additive. Without a pipeline, Runtime retains the Phase 1 behavior of delivering each latest source frame to frame adapters in attachment order. With a pipeline, Runtime builds ordered `MotionFrameInput` values from the latest source map, processes them once per tick, and delivers the single resulting frame to each frame adapter. Legacy `MotionState` adapters and sources are unchanged.

Errors in pipeline processing are isolated at the Runtime boundary; the current tick logs the failure and skips canonical frame delivery rather than affecting legacy output. `stop()` calls `pipeline.reset()` after source shutdown.

## Verification

- mixer tests cover priority, override, weighted blend, masks, missing sources, partial transforms, and quaternion hemisphere handling;
- retarget tests cover mapping, rotation/position offsets, scale, and missing mappings;
- filter tests cover deadzone, clamp, low-pass state, masks, and chains;
- pipeline tests cover stage order and reset;
- Runtime tests cover opt-in processing and compatibility with the raw Phase 1 path;
- package build, full Vitest, ESLint, and relevant documentation formatting are run before Plane Review.

## Risks and mitigations

| Risk                                                              | Mitigation                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A new pipeline could change existing output timing                | Keep attachment opt-in and preserve the existing raw branch byte-for-byte.           |
| Partial source data could be overwritten by a lower-quality layer | Resolve priority per transform component and never invent missing components.        |
| Quaternion blending can flip unexpectedly                         | Align candidate quaternions to the first candidate hemisphere before weighted nlerp. |
| Stateful filters can leak between sessions                        | Give every filter a reset method and call it from pipeline/runtime stop.             |
| Configuration scope could expand Phase 2 too far                  | Keep YAML/CLI serialization out of this package and document the typed API boundary. |
