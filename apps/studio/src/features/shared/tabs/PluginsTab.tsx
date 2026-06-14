import { ExtensionPackEditor } from "../../../components/ExtensionPackEditor";
import { PluginMotionEditor } from "../../../components/PluginMotionEditor";
import { isPluginEnabled, mergeBehaviorPluginsIntoPreset } from "../../../utils/plugin-config";

export interface PluginsTabProps {
  isSimpleMode: boolean;
  emotionPluginEnabled: boolean;
  behaviorPluginsJson: string;
  extensionsJson: string;
  graphJson: string;
  presetJson: string;
  activePluginIds: string[];
  pluginsHaveChanges: boolean;
  applyingPreset: boolean;
  onBehaviorPluginsJsonChange: (json: string) => void;
  onPresetJsonChange: (json: string) => void;
  onExtensionsChange: (extensionsJson: string, presetJson: string) => void;
  onApplyPresetJson: () => void;
}

export function PluginsTab({
  isSimpleMode,
  emotionPluginEnabled,
  behaviorPluginsJson,
  extensionsJson,
  graphJson,
  presetJson,
  activePluginIds,
  pluginsHaveChanges,
  applyingPreset,
  onBehaviorPluginsJsonChange,
  onPresetJsonChange,
  onExtensionsChange,
  onApplyPresetJson,
}: PluginsTabProps) {
  return (
    <section className="plugins-layout">
      <div>
        <h2>{isSimpleMode ? "オプション動き" : "追加プラグイン"}</h2>
        <p className="hint">
          {isSimpleMode
            ? "公式は blink + idle。視線は PFScript / Scratch で調整し、extensions で考え込み・尻尾等を追加します。"
            : "公式 preset は blink + idle。gaze / emotion はレガシー。extensions で Motion Pack を編集します。"}
        </p>
        {emotionPluginEnabled || isPluginEnabled(behaviorPluginsJson, "emotion") ? (
          <p className="hint emotion-plugin-hint">
            Emotion プラグインは{isSimpleMode ? "動作確認" : "Pipeline"} タブの emotion
            を参照します。適用後、感情を選択してください。
          </p>
        ) : null}
        <PluginMotionEditor
          behaviorPluginsJson={behaviorPluginsJson}
          presetJson={presetJson}
          graphJson={graphJson}
          simpleMode={isSimpleMode}
          onChange={(nextBehaviorPluginsJson) => {
            onBehaviorPluginsJsonChange(nextBehaviorPluginsJson);
            onPresetJsonChange(
              mergeBehaviorPluginsIntoPreset(presetJson, nextBehaviorPluginsJson),
            );
          }}
        />
        <ExtensionPackEditor
          presetJson={presetJson}
          extensionsJson={extensionsJson}
          graphJson={graphJson}
          simpleMode={isSimpleMode}
          onChange={onExtensionsChange}
        />
        <button
          type="button"
          className={pluginsHaveChanges ? "primary" : undefined}
          disabled={!pluginsHaveChanges || applyingPreset}
          onClick={() => {
            onApplyPresetJson();
          }}
        >
          {pluginsHaveChanges
            ? isSimpleMode
              ? "変更を反映（未適用あり）"
              : "Apply Plugins（未適用の変更あり）"
            : isSimpleMode
              ? "設定を反映"
              : "Apply Plugins"}
        </button>
      </div>
      {!isSimpleMode ? (
        <div>
          <h2>有効なプラグイン</h2>
          <ul className="plugin-list">
            {activePluginIds.length === 0 ? (
              <li className="hint">有効なプラグインはありません。</li>
            ) : (
              activePluginIds.map((pluginId) => (
                <li key={pluginId}>
                  <span>{pluginId}</span>
                  <span className="badge">active</span>
                </li>
              ))
            )}
          </ul>
          <h2>behaviorPlugins JSON</h2>
          <pre>{behaviorPluginsJson}</pre>
          <h2>extensions JSON</h2>
          <pre>{extensionsJson}</pre>
        </div>
      ) : null}
    </section>
  );
}
