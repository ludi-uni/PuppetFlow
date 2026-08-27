# PFScript Phase 2 Implementation Plan

> **実行状況:** 完了（2026-08-27）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-tick block-local PFScript variables, numeric scalar extension-function expressions, expression-valued Motion Pack configuration, and the approved alias/composition/Preset policies while preserving Phase 1 behavior.

**Architecture:** Keep the existing `pfscript-core` AST/lowering → `behavior` AST/execution pipeline. Add explicit `Let`, `LocalLet`, and `LocalAssign` nodes plus a fresh in-memory scope stack per Behavior execution. Scalar extension functions resolve through an undefined-aware callback; Motion Packs remain statement invocations collected for the existing Extension Layer. Runtime composition, aliases, and Preset source/cache behavior do not gain new precedence rules.

**Tech Stack:** TypeScript 5.8+, ESM workspace packages, Vitest, tsup declaration builds, pnpm 9.15.9, `@puppetflow/pfscript-core`, `@puppetflow/behavior`, `@puppetflow/extension-core`, `@puppetflow/runtime`, and `@puppetflow/preset`.

**Spec:** `docs/superpowers/specs/2026-08-27-pfscript-phase2-design.md`

## Global Constraints

- `let` variables are temporary lexical bindings. A root execution creates one scope; each `if`/`elseif`/`else` branch gets a child scope. A binding is visible after its declaration until the end of that block, and the environment is discarded after the tick.
- PFScript AST gains `Let`. Behavior AST gains `LocalLet` and `LocalAssign`; local statements never produce MotionState output.
- Identifier lookup checks the nearest local binding first, then the existing `currentPhoneme`/time/channel/state resolution. An identifier not currently bound remains compatible with the existing dynamic State/Channel lookup.
- `name = expression` updates the nearest existing local binding; when no local binding exists, it keeps the existing Motion/custom assignment behavior. Nested blocks may shadow an outer name; a same-block `let` rebinds that name when reached.
- Expressions may call builtins, stateful functions, `eventActive`, and registered numeric `MotionFunctionDefinition` values. Pack/Generator side effects are statement-only. Resolution order is stateful function, `eventActive`, builtin, extension scalar function, then unknown-function error; builtins cannot be shadowed by an extension function of the same name.
- `MotionPack` remains a statement. Literal named arguments stay in `config`; non-literal named arguments are stored as `configExpressions` and evaluated once when the statement executes. If literal and non-literal named arguments are mixed, all named arguments are represented in `configExpressions` with literal values wrapped as `Number` expressions. Existing positional Pack arguments remain unsupported as in Phase 1.
- The alias table remains explicit and case-sensitive: existing aliases and legacy replacements are frozen as public behavior; unlisted/case-variant names remain `custom`.
- No new merge priority is introduced. Runtime keeps its current `addMotionState` composition; contexts that call `mergeMotionState` keep averaging. Existing duplicate-output warnings remain diagnostics, not precedence rules.
- `behaviorPfScript` is the Preset source of truth; `behavior` is an optional compiled cache. Load recompiles non-empty source and never falls back to stale cache on a source error. Preset version stays `3`; Studio/export paths continue writing both fields.
- The implementation performs no new filesystem, network, process, Runtime-store, or arbitrary evaluator work; loops, modules, I/O, persistent user variables, and PFScript-to-Graph conversion remain forbidden/out of scope.
- Use the repository's pinned `pnpm@9.15.9`; root-scoped Vitest commands are authoritative because package-local `vitest run --dir .` scripts resolve the root include paths relative to the package directory.

---

### Task 1: PFScript `let` syntax and AST

**Files:**

- Modify: `packages/pfscript-core/src/tokens.ts`
- Modify: `packages/pfscript-core/src/lexer.ts`
- Modify: `packages/pfscript-core/src/forbidden.ts`
- Modify: `packages/pfscript-core/src/ast.ts`
- Modify: `packages/pfscript-core/src/parser.ts`
- Modify: `packages/pfscript-core/src/index.ts`
- Test: `packages/pfscript-core/src/parser.test.ts`

**Interfaces:**

- Consumes: existing `parsePfScript(source: string): PfScriptProgram` and identifier/forbidden-keyword checks.
- Produces: `PfScriptLet`, the `"let"` token, and a parser result that distinguishes declarations from existing Motion assignments.

- [ ] **Step 1: Write failing parser/lexer tests**

Add tests for keyword tokenization, declaration shape, block placement, reserved context names, and malformed declarations:

```ts
it("tokenizes let as a declaration keyword", () => {
  expect(tokenize("let target = interest * 0.5").map((token) => token.type)).toEqual([
    "let",
    "identifier",
    "eq",
    "identifier",
    "star",
    "number",
    "eof",
  ]);
});

it("parses let and keeps later assignment as an assignment node", () => {
  expect(
    parsePfScript("let target = interest * 0.5\ntarget = target + 0.1").body,
  ).toEqual([
    {
      type: "Let",
      name: "target",
      value: {
        type: "Binary",
        op: "*",
        left: { type: "Identifier", name: "interest" },
        right: { type: "Number", value: 0.5 },
      },
    },
    {
      type: "Assign",
      target: "target",
      value: {
        type: "Binary",
        op: "+",
        left: { type: "Identifier", name: "target" },
        right: { type: "Number", value: 0.1 },
      },
    },
  ]);
});

it("rejects special runtime context names as locals", () => {
  for (const name of ["time", "deltaTime", "currentPhoneme"]) {
    expect(() => parsePfScript(`let ${name} = 1`)).toThrow(PfScriptParseError);
  }
});

it("rejects missing let names or initializers", () => {
  expect(() => parsePfScript("let = 1")).toThrow(PfScriptParseError);
  expect(() => parsePfScript("let target")).toThrow(PfScriptParseError);
});
```

- [ ] **Step 2: Run parser tests to verify the red state**

Run: `pnpm exec vitest run packages/pfscript-core/src/parser.test.ts`

Expected: FAIL because `let` has no token and the parser has no `Let` node.

- [ ] **Step 3: Add the token and AST node**

Add `"let"` to `TokenType`, add `let: "let"` to the lexer keyword map, and add:

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

Export `PfScriptLet` from the package barrel. Keep `let` out of `FORBIDDEN_KEYWORDS` so it is lexed as a declaration rather than a generic forbidden token.

- [ ] **Step 4: Implement declaration parsing and local-name guards**

Add `assertLocalIdentifierAllowed(name, line, column)` in `forbidden.ts`. It must call the existing `assertIdentifierAllowed`, then reject exactly `time`, `deltaTime`, and `currentPhoneme` with `PfScriptParseError` carrying the supplied line/column. Update `parseStatement`, `isStatementStart`, and add:

```ts
private parseLet(): PfScriptLet {
  this.expect("let");
  const nameToken = this.expect("identifier");
  assertLocalIdentifierAllowed(nameToken.value, nameToken.line, nameToken.column);
  this.expect("eq");
  const value = this.parseExpression();
  this.skipExtraNewlines();
  return { type: "Let", name: nameToken.value, value };
}
```

Do not change comments, forbidden loop/module syntax, existing assignment parsing, or error locations.

- [ ] **Step 5: Run tests/build and commit**

Run: `pnpm exec vitest run packages/pfscript-core/src/parser.test.ts`

Expected: PASS, including all existing Phase 1 parser tests.

Run: `pnpm --filter @puppetflow/pfscript-core build`

Expected: PASS with `PfScriptLet` in generated declarations.

```bash
git add packages/pfscript-core/src/tokens.ts packages/pfscript-core/src/lexer.ts packages/pfscript-core/src/forbidden.ts packages/pfscript-core/src/ast.ts packages/pfscript-core/src/parser.ts packages/pfscript-core/src/index.ts packages/pfscript-core/src/parser.test.ts
git commit -m "feat(pfscript): add let declaration syntax"
```

### Task 2: Behavior AST and per-execution local scope

**Files:**

- Create: `packages/behavior/src/local-scope.ts`
- Modify: `packages/behavior/src/expr.ts`
- Modify: `packages/behavior/src/ast.ts`
- Modify: `packages/behavior/src/index.ts`
- Modify: `packages/behavior/src/evaluate-expr.ts`
- Modify: `packages/behavior/src/execute.ts`
- Test: `packages/behavior/src/evaluate-expr.test.ts`
- Test: `packages/behavior/src/execute.test.ts`
- Test: `packages/behavior/src/ast.test.ts`

**Interfaces:**

- Consumes: existing `BehaviorExpression`, `BehaviorStatement`, `BehaviorExecutionContext`, and `executeBehaviorWithInvocations`.
- Produces: `BehaviorValue`, `BehaviorLocalLet`, `BehaviorLocalAssign`, and local-aware evaluator signatures; later tasks use local-first lookup and branch scope behavior.

- [ ] **Step 1: Write failing local-scope tests**

Add direct Behavior AST tests for local output isolation, local-first lookup, branch cleanup, outer-binding updates, and per-call lifetime:

```ts
it("uses a local value without emitting a custom key", () => {
  const output = executeBehavior(
    {
      type: "Block",
      statements: [
        { type: "LocalLet", name: "target", value: { type: "Number", value: 0.2 } },
        { type: "LocalAssign", name: "target", value: { type: "Number", value: 0.5 } },
        {
          type: "ExprAssign",
          target: "mouthX",
          value: { type: "Identifier", name: "target" },
        },
      ],
    },
    createCtx(),
  );

  expect(output.mouthX).toBeCloseTo(0.5, 3);
  expect(output.custom?.target).toBeUndefined();
});

it("pops branch locals and updates an outer local", () => {
  const state = new StateStore();
  state.set("interest", 0.8);
  state.set("branchOnly", 0.6);
  const output = executeBehavior(
    {
      type: "Block",
      statements: [
        { type: "LocalLet", name: "value", value: { type: "Number", value: 0.2 } },
        {
          type: "If",
          condition: { left: "interest", op: ">", right: 0.5 },
          then: [
            {
              type: "LocalLet",
              name: "branchOnly",
              value: { type: "Number", value: 0.1 },
            },
            {
              type: "LocalAssign",
              name: "value",
              value: { type: "Number", value: 0.8 },
            },
          ],
        },
        {
          type: "ExprAssign",
          target: "mouthX",
          value: { type: "Identifier", name: "value" },
        },
        {
          type: "ExprAssign",
          target: "mouthY",
          value: { type: "Identifier", name: "branchOnly" },
        },
      ],
    },
    createCtx({ state }),
  );

  expect(output.mouthX).toBeCloseTo(0.8, 3);
  expect(output.mouthY).toBeCloseTo(0.6, 3);
});

it("supports same-block rebinding and nested shadowing", () => {
  const output = executeBehavior(
    {
      type: "Block",
      statements: [
        { type: "LocalLet", name: "value", value: { type: "Number", value: 0.2 } },
        { type: "LocalLet", name: "value", value: { type: "Number", value: 0.4 } },
        {
          type: "If",
          condition: { kind: "Expr", expression: { type: "Boolean", value: true } },
          then: [
            { type: "LocalLet", name: "value", value: { type: "Number", value: 0.8 } },
            {
              type: "ExprAssign",
              target: "mouthY",
              value: { type: "Identifier", name: "value" },
            },
          ],
        },
        {
          type: "ExprAssign",
          target: "mouthX",
          value: { type: "Identifier", name: "value" },
        },
      ],
    },
    createCtx(),
  );

  expect(output.mouthX).toBeCloseTo(0.4, 3);
  expect(output.mouthY).toBeCloseTo(0.8, 3);
});

it("falls back to State/Channel resolution before a later declaration", () => {
  const state = new StateStore();
  state.set("value", 0.7);
  const output = executeBehavior(
    {
      type: "Block",
      statements: [
        {
          type: "ExprAssign",
          target: "mouthX",
          value: { type: "Identifier", name: "value" },
        },
        { type: "LocalLet", name: "value", value: { type: "Number", value: 0.2 } },
      ],
    },
    createCtx({ state }),
  );

  expect(output.mouthX).toBeCloseTo(0.7, 3);
});
```

Add `parseBehaviorRoot` cases for `LocalLet` and `LocalAssign` with non-empty names and expression objects:

```ts
it("parses local Behavior statements from serialized JSON", () => {
  expect(
    parseBehaviorRoot({
      type: "Block",
      statements: [
        { type: "LocalLet", name: "target", value: { type: "Number", value: 0.2 } },
        {
          type: "LocalAssign",
          name: "target",
          value: { type: "Identifier", name: "volume" },
        },
      ],
    }),
  ).toEqual({
    type: "Block",
    statements: [
      { type: "LocalLet", name: "target", value: { type: "Number", value: 0.2 } },
      {
        type: "LocalAssign",
        name: "target",
        value: { type: "Identifier", name: "volume" },
      },
    ],
  });
});
```

- [ ] **Step 2: Run focused Behavior tests to verify they fail**

Run: `pnpm exec vitest run packages/behavior/src/evaluate-expr.test.ts packages/behavior/src/execute.test.ts packages/behavior/src/ast.test.ts`

Expected: FAIL because the statement types and local environment do not exist.

- [ ] **Step 3: Add the value union and internal scope stack**

Define `export type BehaviorValue = number | string | boolean` in `expr.ts`. Create `LocalScopeStack` in `local-scope.ts` with `push()`, `pop()`, `declare(name, value)`, `set(name, value): boolean`, `get(name): BehaviorValue | undefined`, and `snapshot(): ReadonlyMap<string, BehaviorValue>`. `set` and `get` search from the innermost scope outward; `pop` cannot remove the root scope. Keep the mutable stack internal and export only `BehaviorValue`.

- [ ] **Step 4: Extend Behavior AST and evaluator signatures**

Add `BehaviorLocalLet` and `BehaviorLocalAssign` to `BehaviorStatement`, export both types, and change the evaluator signatures additively:

```ts
export function evaluateExpression(
  expression: BehaviorExpression,
  ctx: BehaviorExecutionContext,
  locals?: ReadonlyMap<string, BehaviorValue>,
): BehaviorValue;

export function evaluateExpressionAsNumber(
  expression: BehaviorExpression,
  ctx: BehaviorExecutionContext,
  locals?: ReadonlyMap<string, BehaviorValue>,
): number;
```

Pass `locals` through recursive expression calls. Identifier evaluation checks `locals.get(name)` first, then existing `currentPhoneme`/time/channel/state resolution. Existing two-argument callers remain valid.

- [ ] **Step 5: Thread scope through execution**

Create one `LocalScopeStack` in `executeBehaviorWithInvocations`. `LocalLet` evaluates its value with the current snapshot and declares it; `LocalAssign` evaluates and updates the nearest binding, throwing a descriptive execution error if no binding exists. Selected `If` branches push a child scope and pop it in `finally`; conditions run before the child scope is pushed. Local statements return `{}` and never write MotionState, custom, StateStore, or ChannelStore.

- [ ] **Step 6: Run tests/build and commit**

Run: `pnpm exec vitest run packages/behavior/src/evaluate-expr.test.ts packages/behavior/src/execute.test.ts packages/behavior/src/ast.test.ts`

Expected: PASS, including all existing Behavior tests.

Run: `pnpm --filter @puppetflow/behavior build`

Expected: PASS with local AST types and `BehaviorValue` in declarations.

```bash
git add packages/behavior/src/local-scope.ts packages/behavior/src/expr.ts packages/behavior/src/ast.ts packages/behavior/src/index.ts packages/behavior/src/evaluate-expr.ts packages/behavior/src/execute.ts packages/behavior/src/evaluate-expr.test.ts packages/behavior/src/execute.test.ts packages/behavior/src/ast.test.ts
git commit -m "feat(behavior): add per-execution local scopes"
```

### Task 3: PFScript lowering and expression-valued Pack configuration

**Files:**

- Modify: packages/pfscript-core/src/lower.ts
- Modify: packages/behavior/src/ast.ts
- Modify: packages/behavior/src/index.ts
- Modify: packages/behavior/src/execute.ts
- Test: packages/pfscript-core/src/lower.test.ts
- Test: packages/behavior/src/execute.test.ts
- Test: packages/behavior/src/ast.test.ts

**Interfaces:**

- Consumes: Task 1 PfScriptLet nodes and Task 2 BehaviorLocalLet/BehaviorLocalAssign plus local-aware evaluation.
- Produces: lowerPfScriptToBehavior(program) output with explicit local nodes and BehaviorMotionPack.configExpressions; BehaviorMotionPackInvocation.config remains Record<string, number> for the existing Extension Layer.

- [ ] **Step 1: Write failing lowering and dynamic-Pack tests**

Add these cases to packages/pfscript-core/src/lower.test.ts:

```ts
it("lowers let and later assignment to local Behavior nodes", () => {
  const behavior = lowerPfScriptToBehavior(
    parsePfScript("let target = interest * 0.5\ntarget = target + 0.1\nsmile = target"),
  );

  expect(behavior.statements).toEqual([
    {
      type: "LocalLet",
      name: "target",
      value: {
        type: "Binary",
        op: "*",
        left: { type: "Identifier", name: "interest" },
        right: { type: "Number", value: 0.5 },
      },
    },
    {
      type: "LocalAssign",
      name: "target",
      value: {
        type: "Binary",
        op: "+",
        left: { type: "Identifier", name: "target" },
        right: { type: "Number", value: 0.1 },
      },
    },
    {
      type: "ExprAssign",
      target: "mouthX",
      value: { type: "Identifier", name: "target" },
    },
  ]);
});

it("uses child scopes for branch declarations and inherited scopes for updates", () => {
  const behavior = lowerPfScriptToBehavior(
    parsePfScript(
      "let value = 0.2\nif interest > 0.5 then\n  let branchValue = 0.4\n  value = branchValue\nend\nsmile = value",
    ),
  );

  expect(behavior.statements[1]).toMatchObject({
    type: "If",
    then: [
      { type: "LocalLet", name: "branchValue" },
      { type: "LocalAssign", name: "value" },
    ],
  });
  expect(behavior.statements[2]).toMatchObject({
    type: "ExprAssign",
    target: "mouthX",
  });
});

it("keeps literal-only Pack config and wraps mixed config as expressions", () => {
  const behavior = lowerPfScriptToBehavior(
    parsePfScript(
      "thinking(intensity = 0.8)\nthinking(intensity = interest * 0.5, damping = 0.2)",
    ),
  );

  expect(behavior.statements[0]).toEqual({
    type: "MotionPack",
    packId: "thinking",
    config: { intensity: 0.8 },
  });
  expect(behavior.statements[1]).toMatchObject({
    type: "MotionPack",
    packId: "thinking",
    configExpressions: {
      intensity: { type: "Binary", op: "*" },
      damping: { type: "Number", value: 0.2 },
    },
  });
  expect((behavior.statements[1] as { config?: unknown }).config).toBeUndefined();
});
```

Add an execution test proving a dynamic Pack argument is evaluated once from a local binding:

```ts
it("evaluates dynamic Pack config expressions in the executed branch", () => {
  const result = executeBehaviorWithInvocations(
    {
      type: "Block",
      statements: [
        {
          type: "LocalLet",
          name: "intensity",
          value: { type: "Number", value: 0.6 },
        },
        {
          type: "MotionPack",
          packId: "thinking",
          configExpressions: {
            intensity: { type: "Identifier", name: "intensity" },
          },
        },
      ],
    },
    createCtx(),
  );

  expect(result.packInvocations).toEqual([
    { packId: "thinking", config: { intensity: 0.6 } },
  ]);
});
```

Add parser validation cases for mutually exclusive Pack configurations:

```ts
it("rejects a serialized Pack that contains both config forms", () => {
  expect(() =>
    parseBehaviorRoot({
      type: "Block",
      statements: [
        {
          type: "MotionPack",
          packId: "thinking",
          config: { intensity: 0.8 },
          configExpressions: {
            intensity: { type: "Number", value: 0.8 },
          },
        },
      ],
    }),
  ).toThrow(/config.*configExpressions/i);
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: pnpm exec vitest run packages/pfscript-core/src/lower.test.ts packages/behavior/src/execute.test.ts packages/behavior/src/ast.test.ts

Expected: FAIL because lower.ts drops Let, MotionPack has no configExpressions, and execution cannot evaluate dynamic Pack configuration.

- [ ] **Step 3: Extend Behavior MotionPack validation**

Add configExpressions?: Record<string, BehaviorExpression> to BehaviorMotionPack and export the type. In parseBehaviorRoot, accept either config or configExpressions, reject both together, require a non-array object for either field, and validate every expression entry as a Behavior expression object. Use one recursive helper for serialized expression values:

```ts
const BINARY_OPERATORS = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "==",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "and",
  "or",
]);

function parseBehaviorNamedArg(value: unknown, path: string): BehaviorNamedArgExpr {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("invalid call argument at " + path);
  }
  const arg = value as Record<string, unknown>;
  if (arg.name !== undefined && typeof arg.name !== "string") {
    throw new Error("invalid call argument name at " + path);
  }
  return {
    ...(arg.name === undefined ? {} : { name: arg.name }),
    value: parseBehaviorExpression(arg.value, path + ".value"),
  };
}

function parseBehaviorExpression(value: unknown, path: string): BehaviorExpression {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("invalid expression at " + path);
  }
  const expression = value as Record<string, unknown>;
  switch (expression.type) {
    case "Number":
      if (typeof expression.value !== "number" || !Number.isFinite(expression.value)) {
        throw new Error("invalid Number expression at " + path);
      }
      return { type: "Number", value: expression.value };
    case "String":
      if (typeof expression.value !== "string") {
        throw new Error("invalid String expression at " + path);
      }
      return { type: "String", value: expression.value };
    case "Boolean":
      if (typeof expression.value !== "boolean") {
        throw new Error("invalid Boolean expression at " + path);
      }
      return { type: "Boolean", value: expression.value };
    case "Identifier":
      if (typeof expression.name !== "string" || expression.name.length === 0) {
        throw new Error("invalid Identifier expression at " + path);
      }
      return { type: "Identifier", name: expression.name };
    case "Unary":
      if (expression.op !== "not" && expression.op !== "-") {
        throw new Error("invalid Unary operator at " + path);
      }
      return {
        type: "Unary",
        op: expression.op,
        argument: parseBehaviorExpression(expression.argument, path + ".argument"),
      };
    case "Binary":
      if (typeof expression.op !== "string" || !BINARY_OPERATORS.has(expression.op)) {
        throw new Error("invalid Binary operator at " + path);
      }
      return {
        type: "Binary",
        op: expression.op,
        left: parseBehaviorExpression(expression.left, path + ".left"),
        right: parseBehaviorExpression(expression.right, path + ".right"),
      };
    case "Call":
      if (
        typeof expression.callee !== "string" ||
        expression.callee.length === 0 ||
        !Array.isArray(expression.args)
      ) {
        throw new Error("invalid Call expression at " + path);
      }
      return {
        type: "Call",
        callee: expression.callee,
        args: expression.args.map((arg, index) =>
          parseBehaviorNamedArg(arg, path + ".args[" + index + "]"),
        ),
      };
    default:
      throw new Error("unsupported expression at " + path);
  }
}

if (pack.config !== undefined && pack.configExpressions !== undefined) {
  throw new Error(
    "MotionPack cannot contain both config and configExpressions at " + path,
  );
}
const configExpressions = pack.configExpressions;
if (configExpressions !== undefined) {
  const normalizedExpressions: Record<string, BehaviorExpression> = {};
  if (
    typeof configExpressions !== "object" ||
    configExpressions === null ||
    Array.isArray(configExpressions)
  ) {
    throw new Error("MotionPack configExpressions must be an object at " + path);
  }
  for (const [key, expression] of Object.entries(configExpressions)) {
    normalizedExpressions[key] = parseBehaviorExpression(
      expression,
      path + ".configExpressions." + key,
    );
  }
}
```

- [ ] **Step 4: Implement scope-aware PFScript lowering**

Replace the stateless lowering helper with a traversal that carries visible local names:

```ts
interface LoweringScope {
  readonly names: Set<string>;
  readonly parent?: LoweringScope;
}

function hasLocal(scope: LoweringScope, name: string): boolean {
  for (
    let current: LoweringScope | undefined = scope;
    current;
    current = current.parent
  ) {
    if (current.names.has(name)) {
      return true;
    }
  }
  return false;
}
```

Process statements in source order. PfScriptLet lowers to BehaviorLocalLet and adds its name to the current scope. A PfScriptAssign lowers to BehaviorLocalAssign when hasLocal(scope, target) is true; otherwise it uses the existing alias resolver and emits BehaviorExprAssign. Each then/elseif/else branch receives a child scope; inherited names remain assignable and branch declarations do not escape.

For Pack calls, collect named arguments in source order. If every named value is a Number literal, emit config. If any named value is non-literal, emit configExpressions for every named argument, wrapping literals as { type: "Number", value }. Preserve the existing last-duplicate-name-wins object behavior and keep positional arguments ignored as in Phase 1.

- [ ] **Step 5: Evaluate dynamic Pack configuration at execution time**

Update recordMotionPack to receive the current LocalScopeStack. For configExpressions, evaluate each expression once using evaluateExpressionAsNumber(expression, ctx, locals.snapshot()), build a fresh numeric config object, and append one invocation. For static config, preserve the current direct copy. A local declaration/update returns no motion partial and never becomes an invocation.

- [ ] **Step 6: Run tests/build and commit**

Run: pnpm exec vitest run packages/pfscript-core/src/lower.test.ts packages/behavior/src/execute.test.ts packages/behavior/src/ast.test.ts

Expected: PASS, including existing golden lowering tests and conditional Pack tests.

Run: pnpm --filter @puppetflow/pfscript-core build

Run: pnpm --filter @puppetflow/behavior build

Expected: both PASS with PfScriptLet and BehaviorMotionPack.configExpressions represented in generated declarations.

```bash
git add packages/pfscript-core/src/lower.ts packages/behavior/src/ast.ts packages/behavior/src/index.ts packages/behavior/src/execute.ts packages/pfscript-core/src/lower.test.ts packages/behavior/src/execute.test.ts packages/behavior/src/ast.test.ts
git commit -m "feat(pfscript): lower locals and dynamic Pack args"
```

### Task 4: Scalar extension functions and Runtime callback wiring

**Files:**

- Modify: packages/behavior/src/context.ts
- Modify: packages/behavior/src/evaluate-expr.ts
- Modify: packages/behavior/src/index.ts
- Modify: packages/extension-core/src/execute-extensions.ts
- Modify: packages/extension-core/src/index.ts
- Modify: packages/runtime/src/runtime.ts
- Test: packages/behavior/src/evaluate-expr.test.ts
- Test: packages/extension-core/src/execute-extensions.test.ts
- Test: packages/runtime/src/runtime.test.ts

**Interfaces:**

- Consumes: Task 2 local-aware expression evaluation and Task 3 dynamic Pack invocation; existing MotionFunctionDefinition, ExtensionContext, and Graph callback contracts.
- Produces: evaluateExtensionFunction?: (name: string, args: Record<string, number>) => number | undefined on BehaviorExecutionContext and tryExecutePfScriptFunction(registry, ctx, name, args): number | undefined in extension-core.

- [ ] **Step 1: Write failing scalar-function and Runtime tests**

Add a Behavior test with a callback and a builtin-precedence test:

```ts
it("resolves a scalar extension function after builtins", () => {
  const callback = vi.fn((name: string, args: Record<string, number>) => {
    expect(name).toBe("heartbeat");
    expect(args).toEqual({ amplitude: 0.2 });
    return 0.7;
  });

  const value = evaluateExpressionAsNumber(
    {
      type: "Call",
      callee: "heartbeat",
      args: [{ name: "amplitude", value: { type: "Number", value: 0.2 } }],
    },
    createContext({ evaluateExtensionFunction: callback }),
  );

  expect(value).toBeCloseTo(0.7, 3);
  expect(callback).toHaveBeenCalledTimes(1);
});

it("does not let an extension callback shadow a builtin", () => {
  const callback = vi.fn(() => 0.2);
  const value = evaluateExpressionAsNumber(
    {
      type: "Call",
      callee: "sin",
      args: [{ value: { type: "Number", value: 0 } }],
    },
    createContext({ evaluateExtensionFunction: callback }),
  );

  expect(value).toBe(0);
  expect(callback).not.toHaveBeenCalled();
});
```

Add an Extension Core test for a registered value and an unknown name, a Behavior test for the exact dynamic Pack config (Task 3 already covers the local AST path), and a Runtime test with this source:

```pfscript
let pulse = heartbeat(amplitude = interest * 0.2)
bodyLean = pulse
if interest > 0.5 then
  thinking(intensity = interest * 0.5)
end
```

Set interest to 0.8 and assert the target bodyLean is in 0..1. Use the Behavior invocation test to prove exactly one thinking invocation has config { intensity: 0.4 }; the Runtime test proves the bundled scalar function is wired without changing the existing Extension invocation order.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: pnpm exec vitest run packages/behavior/src/evaluate-expr.test.ts packages/extension-core/src/execute-extensions.test.ts packages/runtime/src/runtime.test.ts

Expected: FAIL because Behavior has no extension callback and Runtime only wires the scalar callback for Graph.

- [ ] **Step 3: Add deterministic Behavior function resolution**

Add the optional callback to BehaviorExecutionContext and refactor evaluateCall so every argument expression is evaluated exactly once. Preserve stateful id/value/target handling, then resolve in this order: stateful registry, eventActive, builtin function, extension callback, unknown-function error. Build the extension record from named finite numbers only; if the callback returns undefined, call the existing unknown-function path. Pass the local read-only snapshot into every argument evaluation.

- [ ] **Step 4: Add undefined-aware Extension Core resolution**

Implement and export:

```ts
export function tryExecutePfScriptFunction(
  registry: MotionRegistryImpl,
  ctx: ExtensionContext,
  name: string,
  args: Record<string, number>,
): number | undefined {
  const fn = registry.functions.get(name);
  return fn ? fn.execute(ctx, args) : undefined;
}

export function executePfScriptFunction(
  registry: MotionRegistryImpl,
  ctx: ExtensionContext,
  name: string,
  args: Record<string, number>,
): number {
  return tryExecutePfScriptFunction(registry, ctx, name, args) ?? 0;
}
```

The existing Graph caller remains numeric and keeps 0 for a missing function; Behavior uses the undefined-aware helper.

- [ ] **Step 5: Wire Runtime Behavior evaluation**

When Runtime calls executeBehaviorWithInvocations, pass an evaluateExtensionFunction closure that builds the same ExtensionContext fields used by the Graph callback (state, channels, deltaTime, time, timeline data, rendered motion, stateful store/registry, and frame) and calls tryExecutePfScriptFunction(getBundledMotionRegistry(), extensionContext, name, args). Do not alter Graph callback wiring, Extension invocation order, or existing motion composition.

- [ ] **Step 6: Run tests/build and commit**

Run: pnpm exec vitest run packages/behavior/src/evaluate-expr.test.ts packages/extension-core/src/execute-extensions.test.ts packages/runtime/src/runtime.test.ts

Expected: PASS, including existing Runtime failure-isolation and Graph function tests.

Run: pnpm --filter @puppetflow/behavior build
Run: pnpm --filter @puppetflow/extension-core build
Run: pnpm --filter @puppetflow/runtime build

Expected: all three builds PASS and declarations include the callback/resolver.

```bash
git add packages/behavior/src/context.ts packages/behavior/src/evaluate-expr.ts packages/behavior/src/index.ts packages/extension-core/src/execute-extensions.ts packages/extension-core/src/index.ts packages/runtime/src/runtime.ts packages/behavior/src/evaluate-expr.test.ts packages/extension-core/src/execute-extensions.test.ts packages/runtime/src/runtime.test.ts
git commit -m "feat(pfscript): call scalar extension functions"
```

### Task 5: Alias, overlap, Preset compatibility, and reference documentation

**Files:**

- Modify: packages/preset/src/collect-preset-motion-keys.ts
- Modify: packages/behavior/src/motion-aliases.ts
- Test: packages/preset/src/collect-preset-motion-keys.test.ts
- Test: packages/behavior/src/motion-aliases.test.ts
- Test: packages/preset/src/load-preset.test.ts
- Test: packages/preset/src/compile-behavior.test.ts
- Modify: docs/reference/pfscript.md

**Interfaces:**

- Consumes: Task 1–4 AST, lowering, execution, and existing Preset source/cache APIs.
- Produces: overlap discovery that ignores local-only nodes, regression coverage for the frozen case-sensitive alias table, and Phase 2 user documentation. Preset JSON remains version 3.

- [ ] **Step 1: Write failing compatibility tests**

Add an alias test:

```ts
it("keeps aliases case-sensitive and sends unknown names to custom", () => {
  expect(resolveMotionAlias("smile")).toBe("mouthX");
  expect(resolveMotionAlias("faceRoll")).toBe("headTilt");
  expect(resolveMotionAlias("Smile")).toBeUndefined();
  expect(resolveAssignTarget("MouthA")).toEqual({ custom: "MouthA" });
});
```

Add an overlap test:

```ts
it("does not report local declarations or updates as Motion keys", () => {
  const warnings = detectPresetMotionOverlaps({
    behavior: {
      type: "Block",
      statements: [
        { type: "LocalLet", name: "smile", value: { type: "Number", value: 0.2 } },
        { type: "LocalAssign", name: "smile", value: { type: "Number", value: 0.4 } },
      ],
    },
    graph: {
      nodes: [{ id: "out", type: "output", data: { key: "mouthX" } }],
      edges: [],
    },
    behaviorPlugins: [],
  });

  expect(warnings).toEqual([]);
});
```

Add Preset tests for source precedence and Phase 2 syntax:

```ts
it("round-trips Phase 2 source as the canonical Preset field", () => {
  const source = "let target = interest * 0.5\nsmile = target";
  const loaded = loadPreset(
    JSON.stringify({
      name: "Phase2Preset",
      version: 3,
      behaviorPfScript: source,
      behavior: { type: "Block", statements: [] },
      graph: { nodes: [], edges: [] },
    }),
  );

  expect(loaded.behaviorPfScript).toBe(source);
  expect(loaded.behavior.statements[0]).toMatchObject({ type: "LocalLet" });
});

it("does not use stale behavior when Phase 2 source is invalid", () => {
  expect(() =>
    loadPreset(
      JSON.stringify({
        name: "BrokenPhase2",
        version: 3,
        behaviorPfScript: "let target =",
        behavior: {
          type: "Block",
          statements: [{ type: "Assign", key: "mouthX", op: "set", value: 0.1 }],
        },
        graph: { nodes: [], edges: [] },
      }),
    ),
  ).toThrow(/\(1:/);
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: pnpm exec vitest run packages/behavior/src/motion-aliases.test.ts packages/preset/src/collect-preset-motion-keys.test.ts packages/preset/src/load-preset.test.ts packages/preset/src/compile-behavior.test.ts

Expected: FAIL because local statement types are unsupported by the collector/parser and the reference has no Phase 2 section.

- [ ] **Step 3: Exclude local-only nodes from Motion-key collection**

Update collectFromStatements to recurse through Block/If, collect only Assign and ExprAssign, and explicitly skip LocalLet/LocalAssign/MotionPack:

```ts
switch (statement.type) {
  case "Assign":
    keys.add(statement.key);
    break;
  case "ExprAssign":
    keys.add(formatBehaviorMotionKey(statement.target));
    break;
  case "LocalLet":
  case "LocalAssign":
  case "MotionPack":
    break;
}
```

Keep formatBehaviorMotionKey and resolveMotionAlias as the single alias path.

- [ ] **Step 4: Preserve the alias and Preset policies**

Do not change the existing alias values. Add tests for exact case-sensitive behavior and custom-key preservation. Keep compilePresetBehavior source precedence and materializePresetBehavior dual-field output; parseBehaviorRoot must accept the new Behavior nodes. Invalid PFScript source still raises PresetPfScriptError with existing line/column fields and never falls back to cached Behavior.

- [ ] **Step 5: Update the PFScript reference**

Add the following Phase 2 section to docs/reference/pfscript.md:

```text
## Phase 2

### Local variables

let name = expression creates a temporary block-local value. It is recreated
each tick and is not written to StateStore, ChannelStore, MotionState, or the
Preset. A branch-local value disappears when the branch ends; assigning an
outer local from a branch updates that outer binding.

### Expression functions and Pack arguments

Numeric extension functions such as
heartbeat(amplitude = interest * 0.2) may be used in expressions. Motion Packs
such as thinking() remain statements, but their named configuration values may
be expressions. Pack expressions are evaluated once when the statement executes.

### Compatibility rules

Aliases remain case-sensitive (smile -> mouthX, mouthOpen -> mouthY).
Unknown names, including MouthA, remain custom keys. Runtime composition and
duplicate-output warnings are unchanged; no PFScript-over-Graph priority is
introduced. behaviorPfScript is the Preset source and behavior is its
version-3 compiled cache.
```

Remove the Phase 1 “not implemented” bullets for locals and Pack argument expressions, while keeping Graph conversion and other forbidden items.

- [ ] **Step 6: Run tests/formatting and commit**

Run: pnpm exec vitest run packages/behavior/src/motion-aliases.test.ts packages/preset/src/collect-preset-motion-keys.test.ts packages/preset/src/load-preset.test.ts packages/preset/src/compile-behavior.test.ts

Expected: PASS.

Run: pnpm exec prettier --check docs/reference/pfscript.md packages/behavior/src/motion-aliases.ts packages/preset/src/collect-preset-motion-keys.ts

Expected: PASS.

```bash
git add packages/preset/src/collect-preset-motion-keys.ts packages/behavior/src/motion-aliases.ts packages/preset/src/collect-preset-motion-keys.test.ts packages/behavior/src/motion-aliases.test.ts packages/preset/src/load-preset.test.ts packages/preset/src/compile-behavior.test.ts docs/reference/pfscript.md
git commit -m "docs(pfscript): document Phase 2 compatibility"
```

### Task 6: Full repository verification and final self-review

**Files:**

- Inspect: `packages/pfscript-core/src/*.ts`
- Inspect: `packages/behavior/src/*.ts`
- Inspect: `packages/extension-core/src/*.ts`
- Inspect: `packages/runtime/src/runtime.ts`
- Inspect: `packages/preset/src/*.ts`
- Inspect: `docs/reference/pfscript.md`

**Interfaces:**

- Consumes: all implementation and documentation changes from Tasks 1–5.
- Produces: fresh repository-wide evidence and a clean, reviewable diff against origin/main.

- [ ] **Step 1: Run focused Phase 2 tests and declaration builds**

Run: pnpm exec vitest run packages/pfscript-core packages/behavior packages/extension-core packages/runtime packages/preset

Expected: PASS with all existing and new tests. Do not use package-local test scripts as the authoritative command because of the root include-path mismatch.

Run: pnpm --filter @puppetflow/pfscript-core build
Run: pnpm --filter @puppetflow/behavior build
Run: pnpm --filter @puppetflow/extension-core build
Run: pnpm --filter @puppetflow/runtime build
Run: pnpm --filter @puppetflow/preset build

Expected: all five builds PASS and generated declarations contain the new AST types, callback, and resolver.

- [ ] **Step 2: Run repository lint, format, build, and tests**

Run: pnpm lint
Run: pnpm format:check
Run: pnpm build
Run: pnpm test

Expected: all PASS; existing Runtime/Graph/Preset behavior remains green.

- [ ] **Step 3: Run the repository verification gate**

Run: pnpm verify

Expected: PASS, including preset generation and the preset-diff guard. If a command fails, fix only the demonstrated in-scope issue, rerun its focused test, then rerun this complete gate.

- [ ] **Step 4: Review API, safety, and complete diff**

Run: git -c safe.directory=D:/99.AITuber/PuppetFlow status --short --branch
Run: git -c safe.directory=D:/99.AITuber/PuppetFlow diff origin/main..HEAD --stat
Run: git -c safe.directory=D:/99.AITuber/PuppetFlow diff origin/main..HEAD --check
Run: git -c safe.directory=D:/99.AITuber/PuppetFlow diff --name-only origin/main..HEAD

Confirm the diff contains only the approved PFScript Phase 2 spec/plan documentation, PFScript/Behavior/Extension/Runtime/Preset changes, tests, and the reference update. Confirm no new dependency, Runtime store, persistent local state, Graph conversion, I/O, loop, secret, or generated dist file is tracked. Confirm aliases, composition, and Preset source/cache contracts remain unchanged.

- [ ] **Step 5: Record final evidence**

Record exact command outputs and test counts in the task report/PR description. Note the known package-local Vitest discovery mismatch separately from passing root-scoped tests; do not call it a code failure unless the test-script configuration is intentionally changed in a separately reviewed fix.
