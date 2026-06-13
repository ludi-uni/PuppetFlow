import { useMemo } from "react";
import { PLUGIN_CATALOG, type CatalogPluginId } from "../constants/plugin-catalog";
import {
  parseBehaviorPluginEntries,
  setPluginEnabled,
  updatePluginParameter,
} from "../utils/plugin-config";

interface PluginMotionEditorProps {
  behaviorPluginsJson: string;
  simpleMode: boolean;
  onChange: (behaviorPluginsJson: string) => void;
}

export function PluginMotionEditor({
  behaviorPluginsJson,
  simpleMode,
  onChange,
}: PluginMotionEditorProps) {
  const entries = useMemo(
    () => parseBehaviorPluginEntries(behaviorPluginsJson),
    [behaviorPluginsJson],
  );
  const entryMap = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries],
  );

  return (
    <div className="plugin-motion-editor">
      {PLUGIN_CATALOG.map((plugin) => {
        const enabled = entryMap.has(plugin.id);
        const config = entryMap.get(plugin.id)?.config;

        return (
          <section key={plugin.id} className="plugin-motion-card">
            <label className="row plugin-toggle-row">
              <span>
                {simpleMode ? plugin.simpleLabel : plugin.label}
                <span className="hint plugin-toggle-desc">{plugin.description}</span>
              </span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => {
                  onChange(
                    setPluginEnabled(
                      behaviorPluginsJson,
                      plugin.id,
                      event.target.checked,
                    ),
                  );
                }}
              />
            </label>

            {enabled && config ? (
              <div className="plugin-parameter-grid">
                <p className="hint plugin-motion-output">
                  動かす部分: {plugin.motionOutputs.join(", ")}
                </p>
                {plugin.parameters.map((parameter) => (
                  <label
                    key={parameter.key}
                    className="row row-slider plugin-param-row"
                  >
                    <span>
                      {simpleMode ? parameter.simpleLabel : parameter.label}
                      <span className="hint">→ {parameter.motionKeys.join(", ")}</span>
                    </span>
                    <input
                      type="range"
                      min={parameter.min}
                      max={parameter.max}
                      step={parameter.step}
                      value={config[parameter.key] ?? parameter.default}
                      onChange={(event) => {
                        onChange(
                          updatePluginParameter(
                            behaviorPluginsJson,
                            plugin.id as CatalogPluginId,
                            parameter.key,
                            Number(event.target.value),
                          ),
                        );
                      }}
                    />
                    <span className="value">
                      {(config[parameter.key] ?? parameter.default).toFixed(3)}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
