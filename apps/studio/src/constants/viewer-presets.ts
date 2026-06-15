import type { MapperTarget, MotionMapperEditorConfig } from "../mapper-config";
import { cloneMapperConfig, resetModelConfig } from "../mapper-config";

export interface ViewerPreset {
  id: string;
  label: string;
  description: string;
  primaryTarget: MapperTarget;
  host: string;
  port: number;
}

export const VIEWER_PRESETS: ViewerPreset[] = [
  {
    id: "vseeface",
    label: "VSeeFace",
    description: "VRM モデルを表示する定番アプリ（VMC 既定ポート）",
    primaryTarget: "vmc",
    host: "127.0.0.1",
    port: 39539,
  },
  {
    id: "nijiexpose",
    label: "nijiexpose",
    description: "Inochi2D / nijigenerate（nijilive）モデル用 Viewer",
    primaryTarget: "live2d",
    host: "127.0.0.1",
    port: 39539,
  },
  {
    id: "live2d",
    label: "Live2D（別アプリ）",
    description: "Live2D Cubism 向けアプリへパラメータ名で OSC 送信",
    primaryTarget: "live2d",
    host: "127.0.0.1",
    port: 39539,
  },
  {
    id: "vrm",
    label: "VRM ブレンドシェイプ",
    description: "VRM 向けブレンドシェイプ名で送信",
    primaryTarget: "vrm",
    host: "127.0.0.1",
    port: 39539,
  },
];

export function findViewerPreset(id: string | undefined): ViewerPreset | undefined {
  if (!id) {
    return undefined;
  }
  return VIEWER_PRESETS.find((preset) => preset.id === id);
}

export function detectViewerPreset(config: MotionMapperEditorConfig): string {
  const stored = findViewerPreset(config.viewerPresetId);
  if (stored) {
    const model = config[stored.primaryTarget];
    if (model.enabled && model.host === stored.host && model.port === stored.port) {
      return stored.id;
    }
  }

  const enabled = (["vmc", "live2d", "vrm"] as const).find(
    (target) => config[target].enabled,
  );
  if (!enabled) {
    return "custom";
  }

  const model = config[enabled];
  const match = VIEWER_PRESETS.find(
    (preset) =>
      preset.primaryTarget === enabled &&
      preset.host === model.host &&
      preset.port === model.port,
  );
  return match?.id ?? "custom";
}

export function applyViewerPreset(
  config: MotionMapperEditorConfig,
  preset: ViewerPreset,
): MotionMapperEditorConfig {
  const next = cloneMapperConfig(config);
  const primaryDefaults = resetModelConfig(preset.primaryTarget);

  for (const target of ["vmc", "live2d", "vrm"] as const) {
    if (target === preset.primaryTarget) {
      next[target] = {
        ...primaryDefaults,
        enabled: true,
        host: preset.host,
        port: preset.port,
        customParams: { ...(next[target].customParams ?? {}) },
        customTransforms: { ...(next[target].customTransforms ?? {}) },
      };
      continue;
    }

    next[target] = {
      ...next[target],
      enabled: false,
      host: preset.host,
      port: preset.port,
    };
  }

  next.viewerPresetId = preset.id;
  return next;
}
