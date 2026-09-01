/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ActingCommandResult,
  ActingState,
  PuppetFlowRuntime,
} from "@puppetflow/runtime";
import { useActing } from "./useActing";
import {
  act as runtimeAct,
  ensureRuntime,
  getActingState,
  interrupt as runtimeInterrupt,
  sequence as runtimeSequence,
  subscribeActing,
} from "../runtime";

vi.mock("../runtime", () => ({
  act: vi.fn(),
  ensureRuntime: vi.fn(),
  sequence: vi.fn(),
  interrupt: vi.fn(),
  getActingState: vi.fn(),
  subscribeActing: vi.fn(),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const initialState: ActingState = {
  elapsed: 0,
  remaining: 0,
  queueLength: 0,
  blendRemaining: 0,
};

function result(state: ActingState = initialState): ActingCommandResult {
  return { accepted: true, state };
}

describe("useActing", () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;
  let current: ReturnType<typeof useActing> | undefined;

  beforeEach(() => {
    vi.mocked(ensureRuntime).mockResolvedValue({} as PuppetFlowRuntime);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container?.remove();
    root = undefined;
    container = undefined;
    current = undefined;
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

  it("subscribes to acting updates and cleans up on unmount", async () => {
    const unsubscribe = vi.fn();
    vi.mocked(getActingState).mockReturnValue(initialState);
    vi.mocked(subscribeActing).mockReturnValue(unsubscribe);

    await renderHook();

    expect(getActingState).toHaveBeenCalled();
    expect(subscribeActing).toHaveBeenCalledWith(expect.any(Function));

    act(() => root?.unmount());
    expect(unsubscribe).toHaveBeenCalledOnce();
    root = undefined;
  });

  it("subscribes after cold startup resolves exactly once", async () => {
    let resolveRuntime: ((runtime: PuppetFlowRuntime) => void) | undefined;
    const pendingRuntime = new Promise<PuppetFlowRuntime>((resolve) => {
      resolveRuntime = resolve;
    });
    const readyState: ActingState = { ...initialState, queueLength: 1 };
    const unsubscribe = vi.fn();
    vi.mocked(ensureRuntime).mockReturnValue(pendingRuntime);
    vi.mocked(getActingState).mockReturnValue(readyState);
    vi.mocked(subscribeActing).mockReturnValue(unsubscribe);

    await renderHook();

    expect(getActingState).not.toHaveBeenCalled();
    expect(subscribeActing).not.toHaveBeenCalled();

    await act(async () => {
      resolveRuntime?.({} as PuppetFlowRuntime);
      await pendingRuntime;
      await Promise.resolve();
    });

    expect(getActingState).toHaveBeenCalledOnce();
    expect(subscribeActing).toHaveBeenCalledOnce();
    expect(current?.state).toEqual(readyState);

    act(() => root?.unmount());
    expect(unsubscribe).toHaveBeenCalledOnce();
    root = undefined;
  });

  it("does not initialize or subscribe after unmount during cold startup", async () => {
    let resolveRuntime: ((runtime: PuppetFlowRuntime) => void) | undefined;
    const pendingRuntime = new Promise<PuppetFlowRuntime>((resolve) => {
      resolveRuntime = resolve;
    });
    vi.mocked(ensureRuntime).mockReturnValue(pendingRuntime);
    vi.mocked(getActingState).mockReturnValue(initialState);
    vi.mocked(subscribeActing).mockReturnValue(vi.fn());

    await renderHook();

    expect(getActingState).not.toHaveBeenCalled();
    expect(subscribeActing).not.toHaveBeenCalled();

    act(() => root?.unmount());
    root = undefined;

    await act(async () => {
      resolveRuntime?.({} as PuppetFlowRuntime);
      await pendingRuntime;
      await Promise.resolve();
    });

    expect(getActingState).not.toHaveBeenCalled();
    expect(subscribeActing).not.toHaveBeenCalled();
  });

  it("applies accepted command state immediately without waiting for duration", async () => {
    const nextState: ActingState = {
      ...initialState,
      activeAction: { action: "wave", duration: 2 },
      remaining: 2,
    };
    vi.mocked(getActingState).mockReturnValue(initialState);
    vi.mocked(subscribeActing).mockReturnValue(() => {});
    vi.mocked(runtimeAct).mockReturnValue(result(nextState));
    vi.mocked(runtimeSequence).mockReturnValue(result());
    vi.mocked(runtimeInterrupt).mockReturnValue(result());

    await renderHook();

    act(() => {
      current?.act("wave", { duration: 2 });
    });

    expect(runtimeAct).toHaveBeenCalledWith("wave", { duration: 2 });
    expect(current?.state).toEqual(nextState);
    expect(current?.status).toBeNull();
  });

  it("converts command errors into status text", async () => {
    vi.mocked(getActingState).mockReturnValue(initialState);
    vi.mocked(subscribeActing).mockReturnValue(() => {});
    vi.mocked(runtimeInterrupt).mockImplementation(() => {
      throw new Error("Acting runtime is unavailable");
    });

    await renderHook();

    act(() => {
      current?.interrupt();
    });

    expect(current?.status).toBe("Acting runtime is unavailable");
  });
});
