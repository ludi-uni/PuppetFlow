# PFScript Phase 2 Design

**Status:** Draft for user review
**Date:** 2026-08-27

## Goal

Extend the existing PFScript language without changing its character-specific
DSL boundary. Phase 2 adds block-local temporary variables and expression
access to registered scalar extension functions, while allowing expressions in
Motion Pack configuration. Existing aliases, Runtime composition, Preset v3,
and the no-I/O/no-loop safety boundary remain compatible.

## Scope

### In scope

- `let name = expression` declarations with block-local, per-tick lifetime.
- Local-variable reads and updates in expressions, conditions, assignments, and
  Pack arguments.
- A Behavior execution scope that is created for one `executeBehavior` call and
  is never persisted in Runtime, StateStore, ChannelStore, or Preset data.
- Expression calls to numeric `MotionFunctionDefinition` entries through an
  explicit Behavior execution callback.
- Expression-valued Motion Pack arguments evaluated at execution time.
- Formalization and tests for the existing case-sensitive motion alias table.
- Preservation and documentation of the existing Graph/PFScript composition
  and duplicate-output warning behavior.
- Preservation and tests for `behaviorPfScript` as the Preset source of truth
  and `behavior` as its compiled cache.
- Parser, lowering, Behavior execution, Runtime integration, Preset, and
  reference-documentation tests.

### Out of scope

- Persistent user variables, new StateStore keys, or a new variable store in
  Runtime.
- Calling `MotionPackDefinition` or `MotionGeneratorDefinition` as an
  expression or returning a Pack output from an expression.
- PFScript-to-Graph conversion, Graph node semantics, or a new merge-priority
  system.
- Preset version 4, new external fields beyond the existing
  `behaviorPfScript`, or Studio UI redesign.
- `while`, `repeat`, `for`, `goto`, tables/arrays, modules, `os.*`, `io.*`,
  `require`, or arbitrary JavaScript/Lua evaluation.

## Existing baseline

- `@puppetflow/pfscript-core` already parses expressions, `Call` expressions,
  `CallStmt` Pack statements, and lowers assignments to Behavior `ExprAssign`.
- `@puppetflow/behavior` evaluates builtins, stateful functions, and
  `eventActive()` but has no local scope and no extension-function callback.
- `MotionPack` statements are collected by Behavior execution and run later by
  the Extension Layer; `MotionFunctionDefinition` values are already callable
  by Motion Graph through `executePfScriptFunction`.
- `packages/behavior/src/motion-aliases.ts` already maps `smile` to `mouthX`,
  `mouthOpen` to `mouthY`, `eyeOpen` to `eyeYaw`, `eyeSmile` to `eyePitch`, and
  legacy names; unknown names become `custom` keys.
- Runtime currently composes Behavior/Graph/plugin partials with
  `addMotionState`, while Extension Layer and other static merge contexts use
  `mergeMotionState`. Phase 2 does not change either function or introduce
  precedence.
- `behaviorPfScript` is already compiled on load in preference to a stale
  `behavior` cache, and Preset `version` remains `3`.

## Decisions

| ID  | Decision                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `let` variables are temporary lexical bindings. A root execution creates one scope; each `if`/`elseif`/`else` branch gets a child scope. A binding is visible after its declaration until the end of that block, and the environment is discarded after the tick.                                                                                                         |
| D2  | PFScript AST gains `Let`. Behavior AST gains `LocalLet` and `LocalAssign`; local statements never produce MotionState output.                                                                                                                                                                                                                                             |
| D3  | Identifier lookup checks the nearest local binding first, then the existing `currentPhoneme`/time/channel/state resolution. An identifier not currently bound remains compatible with the existing dynamic State/Channel lookup.                                                                                                                                          |
| D4  | `name = expression` updates the nearest existing local binding; when no local binding exists, it keeps the existing Motion/custom assignment behavior. Nested blocks may shadow an outer name; a same-block `let` rebinds that name when reached.                                                                                                                         |
| D5  | Expressions may call builtins, stateful functions, `eventActive`, and registered numeric `MotionFunctionDefinition` values. Pack/Generator side effects are statement-only. Resolution order is stateful function, `eventActive`, builtin, extension scalar function, then unknown-function error; builtins cannot be shadowed by an extension function of the same name. |
| D6  | `MotionPack` remains a statement. Literal named arguments stay in `config`; non-literal named arguments are stored as `configExpressions` and evaluated once when the statement executes. Existing positional Pack arguments remain unsupported as in Phase 1.                                                                                                            |
| D7  | The alias table remains explicit and case-sensitive: existing aliases and legacy replacements are frozen as public behavior; unlisted/case-variant names remain `custom`.                                                                                                                                                                                                 |
| D8  | No new merge priority is introduced. Runtime keeps its current `addMotionState` composition; contexts that call `mergeMotionState` keep averaging. Existing duplicate-output warnings remain diagnostics, not precedence rules.                                                                                                                                           |
| D9  | `behaviorPfScript` is the Preset source of truth; `behavior` is an optional compiled cache. Load recompiles non-empty source and never falls back to stale cache on a source error. Preset version stays `3`; Studio/export paths continue writing both fields.                                                                                                           |

## PFScript syntax and local scope

The new declaration form is:

```pfscript
let targetSmile = interest * 0.5
smile = lerp(smile, targetSmile, 0.1)

if currentPhoneme == "A" then
    let mouthBoost = volume * 0.8
    MouthA = mouthBoost
end
```

`let` becomes a reserved keyword and cannot be used as a callee or assignment
target. Local names use the existing identifier rules and cannot be the
special context names `time`, `deltaTime`, or `currentPhoneme`. Local values
may be number, string, or boolean primitives; Motion/custom assignment keeps
the existing numeric conversion and `0..1` clamp.

The PFScript AST addition is:

```ts
export interface PfScriptLet {
  type: "Let";
  name: string;
  value: PfScriptExpression;
}

export type PfScriptStatement =
  | PfScriptAssign
  | PfScriptLet
  | PfScriptIf
  | PfScriptCallStmt;
```

The Behavior AST additions are:

```ts
export interface BehaviorLocalLet {
  type: "LocalLet";
  name: string;
  value: BehaviorExpression;
}

export interface BehaviorLocalAssign {
  type: "LocalAssign";
  name: string;
  value: BehaviorExpression;
}

export interface BehaviorMotionPack {
  type: "MotionPack";
  packId: string;
  config?: Record<string, number>;
  configExpressions?: Record<string, BehaviorExpression>;
}
```

`config` and `configExpressions` are mutually exclusive in serialized
Behavior JSON. A local declaration/update returns an empty motion partial. A
local declaration inside a branch is removed when that branch exits; assigning
an outer binding from inside a branch updates the nearest visible outer
binding. A read before its declaration sees no local binding and therefore uses
the existing State/Channel fallback, preserving dynamic identifier behavior.

## Expression and Pack data flow

The public Behavior context gains an optional scalar-function callback:

```ts
export interface BehaviorExecutionContext {
  // existing fields...
  evaluateExtensionFunction?: (
    name: string,
    args: Record<string, number>,
  ) => number | undefined;
}
```

`evaluateExpression` and `evaluateExpressionAsNumber` accept an internal
read-only local-scope argument while retaining their existing two-argument
call signature for callers outside statement execution. The executor creates
the scope stack, passes a flattened read-only view to expression evaluation,
and evaluates local statements in source order.

For an expression call, all argument expressions are evaluated exactly once.
Stateful calls retain their existing support for `id`, `value`, `target`, and
other named primitive arguments. An extension scalar function receives only
finite numeric named arguments in its `Record<string, number>`; a non-numeric
or unsupported extension call raises the same execution error path as an
unknown function. `MotionFunctionDefinition.execute` remains the only
extension expression entry point and its return value is numeric. The
definition may update its own stateful-function state while producing that
value, but it must not emit a MotionState partial or enqueue a Pack.

For a Pack statement, lowering separates numeric literals from expressions:

```pfscript
thinking(intensity = interest * 0.5)
```

becomes a `MotionPack` with `configExpressions.intensity` containing the lowered
binary expression for `interest * 0.5`.
At execution time the expression is evaluated once, converted to a finite
number using the existing numeric-expression policy, and placed in the
`BehaviorMotionPackInvocation.config` record. The Extension Layer then applies
the Pack's existing `configFields` defaults and clamps. Conditional Pack
invocations preserve source order and are not deduplicated. Expression
evaluation itself never appends to `packInvocations`, so `thinking()` cannot be
double-run through an expression and a statement in the same evaluation.

Runtime supplies the callback by resolving a registered
`MotionFunctionDefinition`; a missing registry entry returns `undefined`,
allowing builtin/stateful/unknown-function handling to remain deterministic.
`@puppetflow/extension-core` adds an undefined-aware
`tryExecutePfScriptFunction(registry, ctx, name, args)` helper. The existing
numeric `executePfScriptFunction` API remains unchanged by returning `0` for a
missing function, while Runtime wires the try-helper to Behavior's optional
callback. The existing Graph callback therefore keeps its current contract.

## Alias, composition, and Preset policy

### Motion aliases

`resolveMotionAlias` remains the one target resolver. The following mappings are
formalized and tested exactly as written:

| PFScript target                         | Motion output                                                     |
| --------------------------------------- | ----------------------------------------------------------------- |
| `smile`                                 | `mouthX`                                                          |
| `mouthOpen`                             | `mouthY`                                                          |
| `eyeOpen`                               | `eyeYaw`                                                          |
| `eyeSmile`                              | `eyePitch`                                                        |
| `faceRoll`, `bodyPitch`, `eyeX`, `eyeY` | existing legacy replacements                                      |
| any unlisted name, including `MouthA`   | `custom` with the original spelling (for example `custom.MouthA`) |

No case folding or automatic phoneme/viseme mapping is added. A local variable
may use an alias spelling, but while that binding is visible the name resolves
to the local value rather than a Motion target.

### Composition

Phase 2 preserves the current pipeline functions and only makes their scope
explicit:

- Runtime's Behavior/Graph/plugin target partials continue through
  `addMotionState` (neutral-relative additive composition).
- Extension/static merge contexts continue through `mergeMotionState` (average
  for duplicate keys).
- `detectPresetMotionOverlaps` continues to warn when Graph and Motion output
  the same resolved key; local statements are excluded because they do not
  produce Motion output.
- No PFScript-over-Graph or Graph-over-PFScript priority is introduced.

### Preset

`behaviorPfScript?: string` remains the canonical source and `behavior` remains
the compiled cache under Preset version `3`. A non-empty source is parsed and
lowered on load even when a cache exists; a syntax/lowering error is surfaced
with the existing line/column diagnostic and does not silently use stale cache.
Presets containing only cached `behavior` remain loadable for compatibility.
Studio/export helpers continue to materialize both source and compiled fields.

## Errors, safety, and compatibility

- Syntax errors, forbidden keywords, and malformed `let` declarations use the
  existing `PfScriptParseError` line/column path.
- Behavior JSON parsing validates `LocalLet`, `LocalAssign`, and
  `configExpressions` shapes and rejects a Pack containing both static and
  expression configs.
- Runtime expression errors are contained by the existing Behavior/Runtime
  failure boundary; a failed Behavior evaluation produces no partial motion or
  Pack invocation result.
- Local scope is synchronous, in-memory, and discarded after one execution; it
  cannot write StateStore, ChannelStore, TimelineStore, Preset, filesystem,
  network, or process state.
- Existing Phase 1 scripts without `let` or extension scalar calls produce the
  same AST/output and keep their current aliases, merge behavior, and Pack
  statement lifecycle.

## Testing and acceptance criteria

1. Parser tests cover `let`, nested blocks, local updates, reserved names,
   existing assignment compatibility, and all Phase 1 forbidden constructs.
2. Lowering tests cover `LocalLet`, `LocalAssign`, case-sensitive aliases, and
   literal versus expression Pack configuration.
3. Behavior tests prove per-call lifetime, branch scope cleanup, nearest-scope
   assignment, local-first identifier resolution, extension scalar callback
   resolution, builtin precedence, and no expression Pack side effects.
4. Runtime integration tests prove a dynamic scalar extension function and a
   conditional Pack with an expression argument execute once per tick and feed
   the existing Extension Layer.
5. Preset tests prove source-over-cache recompilation, stale-cache rejection on
   source errors, version `3`, and round-trip preservation of Phase 2 syntax.
6. Existing full parser, Behavior, Runtime, Graph, Preset, Studio utility, and
   repository verification tests remain green.
7. `docs/reference/pfscript.md` documents local scope, expression scalar
   functions, expression Pack arguments, alias case sensitivity, composition,
   and Preset source/cache rules.
8. Static review confirms no loops, I/O, arbitrary evaluator, persistent local
   state, new Runtime store, or Graph auto-conversion was introduced.

## Planned implementation boundaries

- `packages/pfscript-core`: lexer keyword, AST, parser, lowering, compile/error
  exports, and parser/lowering tests.
- `packages/behavior`: local scope evaluator/executor, Behavior AST validation,
  dynamic Pack invocation, extension callback, and unit tests.
- `packages/extension-core` and `packages/runtime`: the optional undefined-aware
  scalar-function resolver and Behavior callback wiring only; existing Graph
  function behavior remains unchanged.
- `packages/preset`: only validation/collection adjustments needed for new
  Behavior statement types and local-output exclusion; Preset schema version
  remains `3`.
- `docs/reference/pfscript.md`: Phase 2 syntax and lifecycle reference.

No Runtime/Studio UI redesign, Graph conversion, persistent variable storage,
or new external I/O is part of this specification.

## Open questions

None for this scope. The four previously open product decisions—alias policy,
`thinking()` execution path, PFScript/Graph composition, and Preset source/cache
authority—are resolved above.
