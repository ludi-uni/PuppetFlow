import { hasLipsyncGraph } from "../constants/lipsync-template";
import { parseSimpleMappingsFromGraph } from "../constants/simple-mapping";
import type { TabId } from "../constants/studio-mode";
import type { MotionMapperEditorConfig } from "../mapper-config";
import {
  collectLoadPresetWarnings,
  formatLoadOverlapWarnings,
} from "./preset-warnings";

export type NextStepStatus = "action" | "ready";

export interface NextStepGuide {
  status: NextStepStatus;
  message: string;
  detail: string;
  tab: TabId;
  tabLabel: string;
}

export interface NextStepContext {
  mapperConfig: MotionMapperEditorConfig;
  graphJson: string;
  pluginsHaveChanges: boolean;
  assembledPresetJson?: string;
}

function hasOscTargetEnabled(mapperConfig: MotionMapperEditorConfig): boolean {
  return (["vmc", "live2d", "vrm"] as const).some(
    (target) => mapperConfig[target].enabled,
  );
}

function hasMappingConfiguration(graphJson: string): boolean {
  if (parseSimpleMappingsFromGraph(graphJson).length > 0) {
    return true;
  }

  try {
    const graph = JSON.parse(graphJson) as { nodes?: Array<{ type?: string }> };
    const nodes = graph.nodes ?? [];
    if (nodes.some((node) => node.type === "output")) {
      return true;
    }
    return hasLipsyncGraph(graph);
  } catch {
    return false;
  }
}

export function resolveNextStep(context: NextStepContext): NextStepGuide {
  if (!hasOscTargetEnabled(context.mapperConfig)) {
    return {
      status: "action",
      message: "キャラへの送信先がまだ選ばれていません",
      detail:
        "VSeeFace や nijiexpose など、使っている Viewer アプリを選んで「送信設定を反映」してください。",
      tab: "mapper",
      tabLabel: "キャラへの送信",
    };
  }

  if (context.assembledPresetJson) {
    const overlapWarning = formatLoadOverlapWarnings(
      collectLoadPresetWarnings(context.assembledPresetJson),
    );
    if (overlapWarning) {
      return {
        status: "action",
        message: "Motion キーの重複があります",
        detail: `${overlapWarning}。笑顔は Graph、体・口は PFScript に分けるなど、どちらか一方に寄せてください。`,
        tab: "presets",
        tabLabel: "キャラの雰囲気",
      };
    }
  }

  if (!hasMappingConfiguration(context.graphJson)) {
    return {
      status: "action",
      message: "キャラの動きのつなぎがまだありません",
      detail:
        "「動きのつなぎ」で、興味や元気と表情・姿勢を結びつけるか、リップシンクを有効にしてください。",
      tab: "mapping",
      tabLabel: "動きのつなぎ",
    };
  }

  if (context.pluginsHaveChanges) {
    return {
      status: "action",
      message: "オプション動きの変更が未反映です",
      detail:
        "まばたきや視線などの設定を変更したら、「設定を反映」ボタンを押してください。",
      tab: "plugins",
      tabLabel: "オプション動き",
    };
  }

  return {
    status: "ready",
    message: "準備完了 — 動作を試せます",
    detail:
      "「動作確認」でスライダーを動かし、外部 Viewer でキャラが動くか確認してください。",
    tab: "pipeline",
    tabLabel: "動作確認",
  };
}
