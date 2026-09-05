/** @vitest-environment jsdom */

import type {
  ControlResult,
  PuppetFlowCapabilities,
  PuppetFlowControlState,
} from "@puppetflow/control";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  act as runtimeAct,
  clearExpression as runtimeClearExpression,
  ensureRuntime,
  interrupt as runtimeInterrupt,
  sequence as runtimeSequence,
  setExpression as runtimeSetExpression,
  subscribeActing,
  type StudioActingSnapshot,
} from "../runtime";
import { useActing } from "./useActing";

vi.mock("../runtime", () => ({
  act: vi.fn(),
  clearExpression: vi.fn(),
  ensureRuntime: vi.fn(),
  sequence: vi.fn(),
  setExpression: vi.fn(),
  interrupt: vi.fn(),
  subscribeActing: vi.fn(),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const initialState: PuppetFlowControlState = {
  acting: { elapsed: 0, remaining: 0, queuedActions: 0, blendRemaining: 0 },
  expression: { elapsed: 0, remaining: 0, fadeRemaining: 0 },
};
const capabilities: PuppetFlowCapabilities = {
  acting: { actions: ["idle", "wave"], sequence: true, interrupt: true },
  expressions: { names: ["neutral", "happy"], clear: true },
};
const readySnapshot: StudioActingSnapshot = {
  state: initialState,
  capabilities,
  ready: true,
};

function result(state: PuppetFlowControlState = initialState): ControlResult {
  return { accepted: true, state };
}

describe("useActing", () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;
  let current: ReturnType<typeof useActing> | undefined;
  let notify: ((snapshot: StudioActingSnapshot) => void) | undefined;

  beforeEach(() => {
    vi.mocked(ensureRuntime).mockResolvedValue();
    vi.mocked(subscribeActing).mockImplementation((listener) => {
      notify = listener;
      listener(readySnapshot);
      return vi.fn();
    });
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    current = undefined;
    notify = undefined;
    vi.clearAllMocks();
  });

  async function renderHook(): Promise<void> {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        createElement(() => {
          current = useActing();
          return null;
        }),
      );
      await Promise.resolve();
    });
  }

  it("subscribes once after startup and cleans up on unmount", async () => {
    const unsubscribe = vi.fn();
    vi.mocked(subscribeActing).mockImplementation((listener) => {
      listener(readySnapshot);
      return unsubscribe;
    });

    await renderHook();

    expect(subscribeActing).toHaveBeenCalledOnce();
    expect(current).toMatchObject({ state: initialState, capabilities, ready: true });
    act(() => root?.unmount());
    expect(unsubscribe).toHaveBeenCalledOnce();
    root = undefined;
  });

  it("does not subscribe or update after unmount during cold startup", async () => {
    let resolveRuntime: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      resolveRuntime = resolve;
    });
    vi.mocked(ensureRuntime).mockReturnValue(pending);

    await renderHook();
    act(() => root?.unmount());
    root = undefined;
    await act(async () => {
      resolveRuntime?.();
      await pending;
    });

    expect(subscribeActing).not.toHaveBeenCalled();
  });

  it("forwards complete canonical action and expression requests", async () => {
    const nextState: PuppetFlowControlState = {
      ...initialState,
      acting: {
        ...initialState.acting,
        activeAction: { action: "wave", duration: 2, blendDuration: 0.2 },
        remaining: 2,
      },
    };
    vi.mocked(runtimeAct).mockReturnValue(result(nextState));
    vi.mocked(runtimeSequence).mockReturnValue(result());
    vi.mocked(runtimeInterrupt).mockReturnValue(result());
    vi.mocked(runtimeSetExpression).mockReturnValue(result());
    vi.mocked(runtimeClearExpression).mockReturnValue(result());
    await renderHook();

    await act(async () => {
      await current?.act({
        action: "wave",
        side: "right",
        intensity: 0.6,
        speed: 1.2,
        duration: 2,
        blendDuration: 0.2,
      });
      await current?.sequence({ actions: [{ action: "nod", duration: 0.5 }] });
      await current?.interrupt();
      await current?.setExpression({
        expression: "happy",
        intensity: 0.5,
        duration: 1.5,
        fadeIn: 0.1,
        fadeOut: 0.2,
      });
      await current?.clearExpression({ fadeOut: 0.2 });
    });

    expect(runtimeAct).toHaveBeenCalledWith({
      action: "wave",
      side: "right",
      intensity: 0.6,
      speed: 1.2,
      duration: 2,
      blendDuration: 0.2,
    });
    expect(runtimeSequence).toHaveBeenCalledWith({
      actions: [{ action: "nod", duration: 0.5 }],
    });
    expect(runtimeSetExpression).toHaveBeenCalledWith({
      expression: "happy",
      intensity: 0.5,
      duration: 1.5,
      fadeIn: 0.1,
      fadeOut: 0.2,
    });
    expect(runtimeClearExpression).toHaveBeenCalledWith({ fadeOut: 0.2 });
  });

  it("keeps a rejection reason across ordinary state notifications", async () => {
    vi.mocked(runtimeAct).mockReturnValue({
      accepted: false,
      reason: "Action is unavailable for this profile",
      state: initialState,
    });
    await renderHook();

    await act(async () => {
      await current?.act({ action: "wave" });
    });
    act(() => notify?.({ ...readySnapshot, state: { ...initialState } }));

    expect(current?.status).toBe("Action is unavailable for this profile");
  });
});
