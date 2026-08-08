/** @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_MAPPER_CONFIG, cloneMapperConfig } from "../../../mapper-config";
import { MapperTab } from "./MapperTab";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function renderMapperTab(
  root: Root,
  mapperEditorKey: number,
  live2dFaceYawParameter: string,
): void {
  const config = cloneMapperConfig(DEFAULT_MAPPER_CONFIG);
  config.live2d.enabled = true;
  config.live2d.params.faceYaw = live2dFaceYawParameter;

  act(() => {
    root.render(
      createElement(MapperTab, {
        isSimpleMode: false,
        mapperEditorKey,
        appliedMapperConfig: config,
        activePluginIds: [],
        extensionCustomParamIds: [],
        onApplySimpleMapper: async () => {},
        onApplyExpertMapper: async () => {},
        onStudioModeChange: () => {},
        onStayOnMapperTab: () => {},
      }),
    );
  });
}

describe("MapperTab", () => {
  let container: HTMLDivElement | undefined;
  let root: Root | undefined;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it("keeps the selected Live2D target after the editor refreshes", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    renderMapperTab(root, 0, "ParamAngleY");
    const live2dButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Live2D",
    );
    expect(live2dButton).toBeDefined();

    act(() => {
      live2dButton?.click();
    });
    expect(live2dButton?.className).toContain("active");
    expect(
      container.querySelector<HTMLInputElement>('input[placeholder="(skip)"]')?.value,
    ).toBe("ParamAngleY");

    renderMapperTab(root, 1, "ParamAngleX");

    expect(
      Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Live2D",
      )?.className,
    ).toContain("active");
    expect(
      container.querySelector<HTMLInputElement>('input[placeholder="(skip)"]')?.value,
    ).toBe("ParamAngleX");
  });
});
