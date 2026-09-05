/** @vitest-environment jsdom */

import type {
  ActRequest,
  ControlResult,
  PuppetFlowControlState,
  SequenceRequest,
  SetExpressionRequest,
} from "@puppetflow/control";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getTabsForMode } from "../../../constants/studio-mode";
import type { UseActingResult } from "../../../hooks/useActing";
import { ActingTab } from "./ActingTab";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const state: PuppetFlowControlState = {
  acting: {
    activeAction: { action: "wave" },
    elapsed: 0.25,
    remaining: 0.75,
    queuedActions: 2,
    blendRemaining: 0.1,
  },
  expression: {
    activeExpression: { expression: "happy" },
    elapsed: 0.1,
    remaining: 0.9,
    fadeRemaining: 0,
  },
};
const mockAct = vi.fn<(request: ActRequest) => ControlResult | undefined>();
const mockSequence = vi.fn<(request: SequenceRequest) => ControlResult | undefined>();
const mockInterrupt = vi.fn<() => ControlResult | undefined>();
const mockSetExpression =
  vi.fn<(request: SetExpressionRequest) => ControlResult | undefined>();
const mockClearExpression = vi.fn<UseActingResult["clearExpression"]>();

const fullCapabilities = {
  acting: {
    actions: [
      "idle",
      "wave",
      "look_left",
      "look_right",
      "head_tilt",
      "small_wave",
      "look_camera",
    ],
    sequence: true,
    interrupt: true,
  },
  expressions: { names: ["neutral", "happy"], clear: true },
} as const;

describe("ActingTab", () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;
  const acting: UseActingResult = {
    state,
    capabilities: fullCapabilities,
    ready: true,
    status: null,
    act: mockAct,
    sequence: mockSequence,
    interrupt: mockInterrupt,
    setExpression: mockSetExpression,
    clearExpression: mockClearExpression,
  };

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    acting.ready = true;
    acting.status = null;
    acting.capabilities = fullCapabilities;
    vi.clearAllMocks();
  });

  function renderTab(): void {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(createElement(ActingTab, acting)));
  }

  const findButton = (text: string) =>
    Array.from(container?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent === text,
    );

  it("registers Acting as an expert-only tab", () => {
    expect(getTabsForMode("expert").map((tab) => tab.id)).toContain("acting");
    expect(getTabsForMode("simple").map((tab) => tab.id)).not.toContain("acting");
  });

  it("uses capabilities and readiness for available controls", () => {
    acting.ready = false;
    acting.capabilities = {
      acting: { actions: ["idle", "wave"], sequence: true, interrupt: false },
      expressions: { names: ["neutral"], clear: false },
    };
    renderTab();

    expect(findButton("wave")).toBeDefined();
    expect(findButton("look_left")).toBeUndefined();
    expect(findButton("happy")).toBeUndefined();
    expect(findButton("wave")?.disabled).toBe(true);
    expect(findButton("interrupt")?.disabled).toBe(true);
    expect(findButton("Clear expression")?.disabled).toBe(true);
    expect(findButton("Run acceptance sequence")?.disabled).toBe(true);
    expect(container?.textContent).toContain("Missing required actions");
  });

  it("sends complete canonical requests and preserves the acceptance sequence", () => {
    renderTab();
    act(() => findButton("wave")?.click());
    act(() => findButton("Run acceptance sequence")?.click());
    act(() => findButton("happy")?.click());
    act(() => findButton("Clear expression")?.click());

    expect(mockAct).toHaveBeenCalledWith({
      action: "wave",
      intensity: 1,
      duration: 1,
      speed: 1,
      side: "both",
    });
    expect(mockSequence).toHaveBeenCalledWith({
      actions: [
        "look_left",
        "look_right",
        "head_tilt",
        "small_wave",
        "look_camera",
      ].map((action) => ({
        action,
        intensity: 1,
        duration: 1,
        speed: 1,
        side: "both",
      })),
    });
    expect(mockSetExpression).toHaveBeenCalledWith({
      expression: "happy",
      intensity: 1,
      duration: 1,
      fadeIn: 0.15,
      fadeOut: 0.15,
    });
    expect(mockClearExpression).toHaveBeenCalledWith({ fadeOut: 0.15 });
  });

  it("renders canonical nested state without exposing BlendShape names", () => {
    renderTab();

    expect(container?.textContent).toContain("wave");
    expect(container?.textContent).toContain("Queue: 2");
    expect(container?.textContent).toContain("happy");
    expect(container?.textContent).not.toContain("Warai");
  });
});
