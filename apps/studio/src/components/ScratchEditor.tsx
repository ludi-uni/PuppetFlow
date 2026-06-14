import type { BehaviorBlock } from "@puppetflow/behavior";
import * as Blockly from "blockly/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { registerScratchBlocks, SCRATCH_TOOLBOX } from "../scratch/block-definitions";
import {
  extensionScratchToolbox,
  registerExtensionScratchBlocks,
} from "../scratch/extension-blocks";
import {
  registerStatefulScratchBlocks,
  statefulScratchToolbox,
} from "../scratch/stateful-blocks";
import {
  findStatefulPluginConflicts,
  formatStatefulPluginConflictWarning,
} from "../utils/stateful-conflicts";
import {
  behaviorToPresetBehaviorJson,
  mergeBehaviorIntoPreset,
  workspaceToBehavior,
} from "../scratch/workspace-to-behavior";
import { ActivePluginsPanel } from "./ActivePluginsPanel";
import "blockly/blocks";

interface ScratchEditorProps {
  onApply: (behavior: BehaviorBlock, mergedPresetJson: string) => void;
  onPreviewJson: (behaviorJson: string) => void;
  presetJson: string;
  behaviorPluginsJson: string;
  activePluginIds: string[];
  onStatus: (message: string, kind: "success" | "error" | "info") => void;
}

let blocksRegistered = false;

export function ScratchEditor({
  onApply,
  onPreviewJson,
  presetJson,
  behaviorPluginsJson,
  activePluginIds,
  onStatus,
}: ScratchEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [previewBehavior, setPreviewBehavior] = useState<BehaviorBlock | null>(null);

  const conflictWarning = useMemo(() => {
    if (!previewBehavior) {
      return null;
    }
    return formatStatefulPluginConflictWarning(
      findStatefulPluginConflicts(behaviorPluginsJson, previewBehavior),
    );
  }, [behaviorPluginsJson, previewBehavior]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (!blocksRegistered) {
      registerScratchBlocks();
      registerExtensionScratchBlocks();
      registerStatefulScratchBlocks();
      blocksRegistered = true;
    }

    const extensionCategory = extensionScratchToolbox();
    const statefulCategory = statefulScratchToolbox();
    const toolbox = {
      ...SCRATCH_TOOLBOX,
      contents: [
        ...SCRATCH_TOOLBOX.contents,
        ...(statefulCategory ? [statefulCategory] : []),
        ...(extensionCategory ? [extensionCategory] : []),
      ],
    };

    const workspace = Blockly.inject(containerRef.current, {
      toolbox,
      trashcan: true,
      scrollbars: true,
      sounds: false,
      renderer: "geras",
      theme: Blockly.Theme.defineTheme("puppetflow-dark", {
        base: Blockly.Themes.Classic,
        componentStyles: {
          workspaceBackgroundColour: "#0f172a",
          toolboxBackgroundColour: "#1e293b",
          toolboxForegroundColour: "#e2e8f0",
          flyoutBackgroundColour: "#1e293b",
          flyoutForegroundColour: "#e2e8f0",
          scrollbarColour: "#475569",
        },
      }),
    });

    workspaceRef.current = workspace;

    const changeListener = () => {
      const behavior = workspaceToBehavior(workspace);
      setPreviewBehavior(behavior);
      onPreviewJson(behaviorToPresetBehaviorJson(behavior));
    };

    workspace.addChangeListener(changeListener);
    changeListener();

    return () => {
      workspace.removeChangeListener(changeListener);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [onPreviewJson]);

  return (
    <section className="scratch-editor">
      <p className="hint">
        条件分岐（If）と Motion 代入は Scratch ブロックで編集します。Natural Motion
        カテゴリから呼吸・追従・視線・瞬きの stateful ブロックも使えます。適用時は
        behaviorPlugins と graph を保持します。数値マッピングは Graph Editor
        を使ってください。
      </p>
      <ActivePluginsPanel pluginIds={activePluginIds} />
      {conflictWarning ? (
        <p className="hint emotion-plugin-hint">⚠ {conflictWarning}</p>
      ) : null}
      <div className="scratch-canvas" ref={containerRef} />
      <div className="scratch-actions">
        <button
          type="button"
          onClick={() => {
            const workspace = workspaceRef.current;
            if (!workspace) {
              onStatus("ワークスペースの準備ができていません。", "error");
              return;
            }

            try {
              const behavior = workspaceToBehavior(workspace);
              const conflicts = findStatefulPluginConflicts(behaviorPluginsJson, behavior);
              const merged = mergeBehaviorIntoPreset(presetJson, behavior);
              onApply(behavior, merged);
              if (conflicts.length > 0) {
                onStatus(
                  `behavior を Preset に反映しました（警告: ${formatStatefulPluginConflictWarning(conflicts)}）`,
                  "info",
                );
              } else {
                onStatus("behavior を Preset に反映しました。", "success");
              }
            } catch (error) {
              onStatus(
                error instanceof Error
                  ? error.message
                  : "behavior の適用に失敗しました。",
                "error",
              );
            }
          }}
        >
          behavior を Preset に適用
        </button>
      </div>
    </section>
  );
}
