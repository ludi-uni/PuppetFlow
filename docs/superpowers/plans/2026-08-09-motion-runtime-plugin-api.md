# PuppetFlow Motion Runtime Plugin API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a programmatic plugin registry that creates MotionSource, MotionFrameFilter, and MotionFrameAdapter instances and prove those products work through the existing Runtime lifecycle.

**Architecture:** Keep lifecycle factories separate from the existing MotionState-oriented `ExtensionPlugin`. Add a typed registry in `@puppetflow/extension-core`; callers create instances by capability/type and attach them through existing Runtime and pipeline APIs.

**Tech Stack:** TypeScript 5.9, `@puppetflow/extension-core`, `@puppetflow/source-core`, `@puppetflow/motion-pipeline`, `@puppetflow/adapter-core`, `@puppetflow/runtime`, Vitest 3, tsup, pnpm workspaces.

## Global Constraints

- Preserve the existing `ExtensionPlugin`, `MotionRegistry`, PFScript, MotionState, and bundled plugins without migration.
- Use separate factory namespaces for source, filter, and frame adapter; permit the same type ID once per capability.
- Factory creation is synchronous and does not start or initialize the returned object.
- Empty and duplicate type IDs fail during registration; unknown types and factory validation failures propagate to the caller.
- Runtime retains ownership of source/adapter lifecycle and execution-time error isolation.
- Add no external dependency and no YAML/CLI automatic factory instantiation.
- Follow RED-GREEN-REFACTOR for each production behavior.
- Implement after the MotionFrame Graph plan so final examples can use both Phase 4 APIs.

---

### Task 1: Define and implement the MotionRuntimePlugin registry

**Files:**

- Create: `packages/extension-core/src/motion-runtime-registry.ts`
- Create: `packages/extension-core/src/motion-runtime-registry.test.ts`
- Modify: `packages/extension-core/src/index.ts`
- Modify: `packages/extension-core/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `MotionSource`, `MotionFrameFilter`, and `MotionFrameAdapter` from their existing packages.
- Produces: `MotionRuntimeFactoryConfig`, three factory definition interfaces, `MotionRuntimePlugin`, `MotionRuntimeRegistry`, `MotionRuntimeRegistryImpl`, `createMotionRuntimeRegistry()`, and `registerMotionRuntimePlugins()`.

- [ ] **Step 1: Write failing registration and creation tests**

Create `motion-runtime-registry.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  createMotionRuntimeRegistry,
  registerMotionRuntimePlugins,
  type MotionRuntimePlugin,
} from "./motion-runtime-registry.js";

describe("MotionRuntimeRegistry", () => {
  it("creates registered source, filter, and frame adapter products", () => {
    const source = {
      id: "source",
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
    };
    const filter = { id: "filter", apply: vi.fn((frame) => frame), reset: vi.fn() };
    const adapter = {
      id: "adapter",
      initialize: vi.fn(async () => {}),
      updateFrame: vi.fn(async () => {}),
      dispose: vi.fn(async () => {}),
    };
    const plugin: MotionRuntimePlugin = {
      id: "synthetic",
      register(registry) {
        registry.addSourceFactory({
          type: "synthetic",
          create: (config) => {
            expect(config).toEqual({ rate: 60 });
            return source;
          },
        });
        registry.addFilterFactory({ type: "double", create: () => filter });
        registry.addFrameAdapterFactory({ type: "capture", create: () => adapter });
      },
    };

    const registry = registerMotionRuntimePlugins([plugin]);
    expect(registry.createSource("synthetic", { rate: 60 })).toBe(source);
    expect(registry.createFilter("double", {})).toBe(filter);
    expect(registry.createFrameAdapter("capture", {})).toBe(adapter);
  });

  it("rejects empty, duplicate, and unknown capability types", () => {
    const registry = createMotionRuntimeRegistry();
    const createSource = () => ({
      id: "stub-source",
      start: async () => {},
      stop: async () => {},
    });
    expect(() => registry.addSourceFactory({ type: "", create: createSource })).toThrow(
      "non-empty",
    );
    registry.addSourceFactory({ type: "same", create: createSource });
    expect(() =>
      registry.addSourceFactory({ type: "same", create: createSource }),
    ).toThrow("already registered");
    expect(() => registry.createFilter("missing", {})).toThrow(
      "Unknown motion filter factory",
    );
  });

  it("allows one shared type ID in different capability namespaces", () => {
    const registry = createMotionRuntimeRegistry();
    registry.addSourceFactory({
      type: "vmc",
      create: () => ({ id: "vmc-in", start: async () => {}, stop: async () => {} }),
    });
    registry.addFrameAdapterFactory({
      type: "vmc",
      create: () => ({
        id: "vmc-out",
        initialize: async () => {},
        updateFrame: async () => {},
        dispose: async () => {},
      }),
    });
  });

  it("registers plugins in order and preserves factory errors", () => {
    const order: string[] = [];
    const failure = new Error("invalid filter config");
    const registry = registerMotionRuntimePlugins([
      { id: "first", register: () => order.push("first") },
      {
        id: "second",
        register(registry) {
          order.push("second");
          registry.addFilterFactory({
            type: "broken",
            create: () => {
              throw failure;
            },
          });
        },
      },
    ]);

    expect(order).toEqual(["first", "second"]);
    expect(() => registry.createFilter("broken", {})).toThrow(failure);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
pnpm exec vitest run packages/extension-core/src/motion-runtime-registry.test.ts
```

Expected: FAIL because `motion-runtime-registry.js` does not exist.

- [ ] **Step 3: Implement exact factory contracts and registry maps**

Use these public contracts:

```ts
export type MotionRuntimeFactoryConfig = Readonly<Record<string, unknown>>;

export interface MotionSourceFactoryDefinition {
  type: string;
  create(config: MotionRuntimeFactoryConfig): MotionSource;
}

export interface MotionFilterFactoryDefinition {
  type: string;
  create(config: MotionRuntimeFactoryConfig): MotionFrameFilter;
}

export interface MotionFrameAdapterFactoryDefinition {
  type: string;
  create(config: MotionRuntimeFactoryConfig): MotionFrameAdapter;
}

export interface MotionRuntimePlugin {
  id: string;
  register(registry: MotionRuntimeRegistry): void;
}
```

`MotionRuntimeRegistry` exposes the three `add*Factory` and three `create*`
methods. Implement `MotionRuntimeRegistryImpl` with one `Map` per capability and
this concrete guard pattern:

```ts
function addFactory<T extends { type: string }>(
  factories: Map<string, T>,
  capability: string,
  definition: T,
): void {
  const type = definition.type.trim();
  if (!type) throw new Error(`${capability} factory type must be non-empty`);
  if (factories.has(type))
    throw new Error(`${capability} factory already registered: ${type}`);
  factories.set(type, { ...definition, type });
}

function requireFactory<T>(
  factories: ReadonlyMap<string, T>,
  capability: string,
  type: string,
): T {
  const factory = factories.get(type);
  if (!factory) throw new Error(`Unknown ${capability} factory: ${type}`);
  return factory;
}
```

Each `create*` method calls the stored factory with the provided config and does
not catch errors. `registerMotionRuntimePlugins(plugins)` creates a new registry,
rejects empty/duplicate plugin IDs, applies plugins in order, and returns the
registry.

- [ ] **Step 4: Export APIs and update workspace dependency metadata**

Export all runtime-plugin types/functions from `src/index.ts`. Add these existing
workspace dependencies to `packages/extension-core/package.json`:

```json
"@puppetflow/adapter-core": "workspace:*",
"@puppetflow/motion-pipeline": "workspace:*",
"@puppetflow/source-core": "workspace:*"
```

Run `pnpm install --lockfile-only` and verify the extension-core importer contains
all three dependencies without removing the existing motion-graph dependency.

- [ ] **Step 5: Run extension-core regression and build checks**

```powershell
pnpm exec vitest run packages/extension-core/src/motion-runtime-registry.test.ts packages/extension-core/src/extension-core.test.ts
pnpm --filter @puppetflow/extension-core build
```

Expected: all pass and declaration generation resolves all factory product types.

- [ ] **Step 6: Commit the registry**

```powershell
git add packages/extension-core pnpm-lock.yaml
git commit -m "feat: add motion runtime plugin registry"
```

### Task 2: Prove factory products through the Runtime lifecycle

**Files:**

- Create: `packages/runtime/src/motion-runtime-plugin.test.ts`

**Interfaces:**

- Consumes: `registerMotionRuntimePlugins`, existing Runtime attach methods, and `createMotionFramePipeline`.
- Produces: integration evidence only; no new Runtime production API.

- [ ] **Step 1: Write the integration test before changing production code**

Create one real product flow:

```ts
import {
  registerMotionRuntimePlugins,
  type MotionRuntimePlugin,
} from "@puppetflow/extension-core";
import { createMotionFramePipeline } from "@puppetflow/motion-pipeline";
import { describe, expect, it, vi } from "vitest";
import { PuppetFlowRuntime } from "./runtime.js";

it("runs plugin-created source, filter, and adapter through Runtime", async () => {
  const updateFrame = vi.fn(async () => {});
  const reset = vi.fn();
  const plugin: MotionRuntimePlugin = {
    id: "synthetic",
    register(registry) {
      registry.addSourceFactory({
        type: "synthetic",
        create: () => ({
          id: "synthetic",
          start: async (emit) => emit({ timestamp: 1, parameters: { value: 2 } }),
          stop: async () => {},
        }),
      });
      registry.addFilterFactory({
        type: "double",
        create: () => ({
          id: "double",
          apply: (frame) => ({
            ...frame,
            parameters: {
              ...frame.parameters,
              value: (frame.parameters?.value ?? 0) * 2,
            },
          }),
          reset,
        }),
      });
      registry.addFrameAdapterFactory({
        type: "capture",
        create: () => ({
          id: "capture",
          initialize: async () => {},
          updateFrame,
          dispose: async () => {},
        }),
      });
    },
  };

  const registry = registerMotionRuntimePlugins([plugin]);
  const source = registry.createSource("synthetic", {});
  const filter = registry.createFilter("double", {});
  const adapter = registry.createFrameAdapter("capture", {});
  const runtime = new PuppetFlowRuntime()
    .attachMotionSource(source)
    .attachMotionPipeline(
      createMotionFramePipeline({ sourceFilters: { synthetic: [filter] } }),
    )
    .attachMotionAdapter(adapter);

  await runtime.start();
  expect(updateFrame).toHaveBeenCalledWith(
    expect.objectContaining({ parameters: { value: 4 } }),
    expect.any(Number),
  );
  await runtime.stop();
  expect(reset).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the test and interpret the result**

```powershell
pnpm exec vitest run packages/runtime/src/motion-runtime-plugin.test.ts
```

Expected after Task 1: PASS without Runtime production changes. If it fails,
correct the registry or existing API composition; do not add a duplicate lifecycle
API to Runtime.

- [ ] **Step 3: Run related package tests and builds**

```powershell
pnpm exec vitest run packages/extension-core packages/runtime/src/motion-runtime-plugin.test.ts packages/runtime/src/runtime.test.ts
pnpm --filter @puppetflow/extension-core build
pnpm --filter @puppetflow/runtime build
```

Expected: all pass.

- [ ] **Step 4: Commit the integration evidence**

```powershell
git add packages/runtime/src/motion-runtime-plugin.test.ts
git commit -m "test: verify motion runtime plugin integration"
```

### Task 3: Document and demonstrate runtime plugins

**Files:**

- Create: `docs/reference/motion-runtime-plugins.md`
- Create: `examples/motion-runtime-plugin/package.json`
- Create: `examples/motion-runtime-plugin/plugin.ts`
- Create: `examples/motion-runtime-plugin/README.md`
- Modify: `docs/architecture.md`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: completed MotionRuntimePlugin registry and existing Runtime/pipeline APIs.
- Produces: public lifecycle guidance and an executable no-hardware example.

- [ ] **Step 1: Write the reference contract**

Document all factory interfaces, per-capability duplicate rules, config ownership,
error propagation, creation-versus-start lifecycle, attachment examples, and the
explicit non-goal of YAML/CLI instantiation. Include a table mapping products to
their existing attachment point:

```text
MotionSourceFactory       -> runtime.attachMotionSource()
MotionFilterFactory       -> createMotionFramePipeline({ sourceFilters/outputFilters })
MotionFrameAdapterFactory -> runtime.attachMotionAdapter()
```

- [ ] **Step 2: Add a no-hardware plugin example**

Create `@puppetflow/example-motion-runtime-plugin` with `tsx plugin.ts`. Reuse the
synthetic source/double filter/capture adapter idea from the integration test,
but print the captured frame as JSON and stop Runtime cleanly. The example must
use `registerMotionRuntimePlugins()` and must not open sockets.

- [ ] **Step 3: Update architecture and verify the example**

Add the runtime factory registry beside the existing MotionState extension
registry in `docs/architecture.md`; show that factory products rejoin existing
lifecycle APIs rather than introducing a second Runtime.

Run:

```powershell
pnpm install --lockfile-only
pnpm --filter @puppetflow/example-motion-runtime-plugin start
pnpm exec prettier --check docs/reference/motion-runtime-plugins.md docs/architecture.md examples/motion-runtime-plugin
git diff --check
```

Expected: the example prints a frame containing `parameters.value = 4`; format
and diff checks pass.

- [ ] **Step 4: Commit plugin docs and example**

```powershell
git add docs/architecture.md docs/reference/motion-runtime-plugins.md examples/motion-runtime-plugin pnpm-lock.yaml
git commit -m "docs: document motion runtime plugins"
```

### Task 4: Run Phase 4 verification and submit PUPPETFL-3 to Review

**Files:**

- Modify locally: `.codex/tasks/motion-runtime-phase4.md`
- No production file changes unless verification reveals a Phase 4 defect; any defect fix starts with a failing test.

**Interfaces:**

- Consumes: both Phase 4 implementation plans and the approved design.
- Produces: fresh CI-equivalent evidence and Plane Review synchronization.

- [ ] **Step 1: Run closest and package verification**

```powershell
pnpm exec vitest run packages/motion-graph packages/motion-pipeline packages/extension-core packages/runtime/src/motion-runtime-plugin.test.ts packages/runtime/src/runtime.test.ts
pnpm --filter @puppetflow/motion-graph build
pnpm --filter @puppetflow/motion-pipeline build
pnpm --filter @puppetflow/extension-core build
pnpm --filter @puppetflow/runtime build
pnpm --filter @puppetflow/example-motion-frame-graph start
pnpm --filter @puppetflow/example-motion-runtime-plugin start
```

- [ ] **Step 2: Run repository CI-equivalent verification**

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm build
pnpm test
pnpm build:presets
git diff --exit-code -- packages/behavior-packs/presets presets
git diff --check
```

Expected: every command exits 0; full Vitest count is at least the 118-file/450-test baseline plus new Phase 4 tests.

- [ ] **Step 3: Review scope, compatibility, and secrets**

Run:

```powershell
git status --short
git diff --stat main...HEAD
git diff --check main...HEAD
git diff --name-only main...HEAD
```

Confirm only Phase 4 packages/docs/examples, dependency metadata, and the worktree-ignore preparation commit are present. Confirm no credential, token, local absolute path, generated `dist`, or `.codex` task state is committed.

- [ ] **Step 4: Update task state and Plane**

Mark verified acceptance criteria in `.codex/tasks/motion-runtime-phase4.md`. Add one
concise PUPPETFL-3 comment with Implementation, Verification, and Notes. Resolve
the live Review state and move PUPPETFL-3 from In Progress to Review; never move
it to Done automatically.

- [ ] **Step 5: Commit only verification-driven documentation changes if any**

If no tracked file changed, create no empty commit. If the final verification
requires a documentation correction, stage only that file and use:

```powershell
git commit -m "docs: finalize motion runtime phase 4"
```
