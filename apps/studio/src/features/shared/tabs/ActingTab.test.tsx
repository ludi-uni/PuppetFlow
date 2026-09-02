/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTING_ACTION_NAMES,
  type ActingActionParams,
  ActingActionRequest,
  ActingCommandResult,
  ActingExpressionParams,
  ActingState,
} from "@puppetflow/runtime";
import { getTabsForMode } from "../../../constants/studio-mode";
import { ActingTab } from "./ActingTab";
import type { UseActingResult } from "../../../hooks/useActing";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const state: ActingState = {
  activeAction: { action: "wave" },
  elapsed: 0.25,
  remaining: 0.75,
  queueLength: 2,
  blendRemaining: 0.1,
};
const mockAct =
  vi.fn<
    (action: string, params?: ActingActionParams) => ActingCommandResult | undefined
  >();
const mockSequence =
  vi.fn<(actions: readonly ActingActionRequest[]) => ActingCommandResult | undefined>();
const mockInterrupt = vi.fn<() => ActingCommandResult | undefined>();
const mockSetExpression =
  vi.fn<
    (
      expression: string,
      params?: ActingExpressionParams,
    ) => ActingCommandResult | undefined
  >();
const mockClearExpression =
  vi.fn<(params?: { fadeOut?: number }) => ActingCommandResult | undefined>();

describe("ActingTab", () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;
  const acting: UseActingResult = {
    state,
    status: null as string | null,
    act: mockAct,
    sequence: mockSequence,
    interrupt: mockInterrupt,
    setExpression: mockSetExpression,
    clearExpression: mockClearExpression,
  };

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container?.remove();
    root = undefined;
    container = undefined;
    acting.status = null;
    mockAct.mockClear();
    mockSequence.mockClear();
    mockInterrupt.mockClear();
    mockSetExpression.mockClear();
    mockClearExpression.mockClear();
  });

  function renderTab(): void {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => {
      root?.render(createElement(ActingTab, acting));
    });
  }

  it("registers Acting as an expert-only tab", () => {
    expect(getTabsForMode("expert").map((tab) => tab.id)).toContain("acting");
    expect(getTabsForMode("simple").map((tab) => tab.id)).not.toContain("acting");
  });

  it("passes the compact control values to a primitive action", () => {
    renderTab();

    const intensity = container?.querySelector<HTMLInputElement>("#acting-intensity");
    expect(intensity).toBeDefined();
    act(() => {
      if (intensity) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
          intensity,
          "0.6",
        );
        intensity.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    act(() => {
      Array.from(container?.querySelectorAll("button") ?? [])
        .find((button) => button.textContent === "wave")
        ?.click();
    });

    expect(mockAct).toHaveBeenCalledWith("wave", {
      intensity: 0.6,
      duration: 1,
      speed: 1,
      side: "both",
    });
    const actionLabels = new Set(
      Array.from(container?.querySelectorAll("button") ?? []).map(
        (button) => button.textContent,
      ),
    );
    for (const action of ACTING_ACTION_NAMES) {
      expect(actionLabels).toContain(action);
    }
  });

  it("describes the acting controls for the configured VRM", () => {
    renderTab();

    expect(container?.textContent).toContain("configured VRM");
    expect(container?.textContent).not.toContain("AI-Nikechan");
  });

  it("uses semantic expression controls without exposing VRM BlendShape names", () => {
    renderTab();

    const findButton = (text: string) =>
      Array.from(container?.querySelectorAll("button") ?? []).find(
        (button) => button.textContent === text,
      );

    for (const expression of [
      "neutral",
      "happy",
      "sad",
      "angry",
      "relaxed",
      "surprised",
    ]) {
      expect(findButton(expression)).toBeDefined();
    }
    act(() => findButton("happy")?.click());
    act(() => findButton("Clear expression")?.click());

    expect(mockSetExpression).toHaveBeenCalledWith("happy", {
      intensity: 1,
      duration: 1,
      fadeIn: 0.15,
      fadeOut: 0.15,
    });
    expect(mockClearExpression).toHaveBeenCalledWith({ fadeOut: 0.15 });
    expect(container?.textContent).not.toContain("Warai");
    expect(container?.textContent).not.toContain("Sorrow");
  });

  it("wires interrupt, idle, the exact acceptance sequence, and state rendering", () => {
    renderTab();

    const findButton = (text: string) =>
      Array.from(container?.querySelectorAll("button") ?? []).find(
        (button) => button.textContent === text,
      );

    act(() => findButton("interrupt")?.click());
    act(() => findButton("idle")?.click());
    act(() => findButton("Run acceptance sequence")?.click());

    expect(mockInterrupt).toHaveBeenCalledOnce();
    expect(mockAct).toHaveBeenCalledWith("idle", {
      intensity: 1,
      duration: 1,
      speed: 1,
      side: "both",
    });
    expect(mockSequence).toHaveBeenCalledWith([
      { action: "look_left", intensity: 1, duration: 1, speed: 1, side: "both" },
      { action: "look_right", intensity: 1, duration: 1, speed: 1, side: "both" },
      { action: "head_tilt", intensity: 1, duration: 1, speed: 1, side: "both" },
      { action: "small_wave", intensity: 1, duration: 1, speed: 1, side: "both" },
      { action: "look_camera", intensity: 1, duration: 1, speed: 1, side: "both" },
    ]);
    expect(container?.textContent).toContain("wave");
    expect(container?.textContent).toContain("Queue: 2");
  });
});
