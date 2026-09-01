/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActingCommandResult, ActingState } from "@puppetflow/runtime";
import { useActing } from "./useActing";
import {
  act as runtimeAct,
  getActingState,
  interrupt as runtimeInterrupt,
  sequence as runtimeSequence,
  subscribeActing,
} from "../runtime";

vi.mock("../runtime", () => ({
  act: vi.fn(),
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

  function renderHook(): void {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        createElement(() => {
          current = useActing();
          return null;
        }),
      );
    });
  }

  it("subscribes to acting updates and cleans up on unmount", () => {
    const unsubscribe = vi.fn();
    vi.mocked(getActingState).mockReturnValue(initialState);
    vi.mocked(subscribeActing).mockReturnValue(unsubscribe);

    renderHook();

    expect(getActingState).toHaveBeenCalled();
    expect(subscribeActing).toHaveBeenCalledWith(expect.any(Function));

    act(() => root?.unmount());
    expect(unsubscribe).toHaveBeenCalledOnce();
    root = undefined;
  });

  it("applies accepted command state immediately without waiting for duration", () => {
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

    renderHook();

    act(() => {
      current?.act("wave", { duration: 2 });
    });

    expect(runtimeAct).toHaveBeenCalledWith("wave", { duration: 2 });
    expect(current?.state).toEqual(nextState);
    expect(current?.status).toBeNull();
  });

  it("converts command errors into status text", () => {
    vi.mocked(getActingState).mockReturnValue(initialState);
    vi.mocked(subscribeActing).mockReturnValue(() => {});
    vi.mocked(runtimeInterrupt).mockImplementation(() => {
      throw new Error("Acting runtime is unavailable");
    });

    renderHook();

    act(() => {
      current?.interrupt();
    });

    expect(current?.status).toBe("Acting runtime is unavailable");
  });
});
