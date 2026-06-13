import type { MapperTarget, MotionMapperEditorConfig } from "../mapper-config";
import { cloneMapperConfig } from "../mapper-config";

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
    description: "Live2D / VRM 向けビューア（VMC 既定ポート）",
    primaryTarget: "vmc",
    host: "127.0.0.1",
    port: 39539,
  },
  {
    id: "live2d",
    label: "Live2D（別アプリ）",
    description: "Live2D パラメータ名で OSC 送信",
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

export function applyViewerPreset(
  config: MotionMapperEditorConfig,
  preset: ViewerPreset,
): MotionMapperEditorConfig {
  const next = cloneMapperConfig(config);

  for (const target of ["vmc", "live2d", "vrm"] as const) {
    next[target] = {
      ...next[target],
      enabled: target === preset.primaryTarget,
      host: preset.host,
      port: preset.port,
    };
  }

  return next;
}
