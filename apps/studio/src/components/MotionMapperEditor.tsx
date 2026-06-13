import { MOTION_STATE_KEYS } from "@puppetflow/core";
import type { ValueTransform } from "@puppetflow/motion-mapper";
import { useState } from "react";
import { ActivePluginsPanel } from "./ActivePluginsPanel";
import {
  cloneMapperConfig,
  exportModelProfile,
  getMapperTargets,
  type MapperTarget,
  type MotionMapperEditorConfig,
  resetModelConfig,
} from "../mapper-config";

const TRANSFORM_OPTIONS: ValueTransform[] = ["identity", "centered", "invert"];

const TARGET_LABELS: Record<MapperTarget, string> = {
  vmc: "VMC (Generic)",
  live2d: "Live2D",
  vrm: "VRM",
};

interface MotionMapperEditorProps {
  initialConfig: MotionMapperEditorConfig;
  activePluginIds: string[];
  onApply: (config: MotionMapperEditorConfig) => Promise<void>;
}

export function MotionMapperEditor({
  initialConfig,
  activePluginIds,
  onApply,
}: MotionMapperEditorProps) {
  const [config, setConfig] = useState<MotionMapperEditorConfig>(
    cloneMapperConfig(initialConfig),
  );
  const [activeTarget, setActiveTarget] = useState<MapperTarget>("vmc");
  const [exportJson, setExportJson] = useState("");

  const model = config[activeTarget];

  return (
    <section className="mapper-editor">
      <h2>Motion Mapper</h2>
      <p className="hint">
        プラグイン・behavior・graph を通過した <strong>Rendered Motion</strong>{" "}
        を各モデル形式へ 変換して OSC
        で送信します。変換層と送信先はモデルごとに独立して設定できます。
      </p>
      <ActivePluginsPanel pluginIds={activePluginIds} />

      <nav className="mapper-targets">
        {getMapperTargets().map((target) => (
          <button
            key={target}
            type="button"
            className={activeTarget === target ? "tab active" : "tab"}
            onClick={() => setActiveTarget(target)}
          >
            {TARGET_LABELS[target]}
          </button>
        ))}
      </nav>

      <label className="row">
        <span>Send Enabled</span>
        <input
          type="checkbox"
          checked={model.enabled}
          onChange={(event) => {
            setConfig((current) => ({
              ...current,
              [activeTarget]: {
                ...current[activeTarget],
                enabled: event.target.checked,
              },
            }));
          }}
        />
      </label>

      <label className="row">
        <span>Host</span>
        <input
          className="text-input"
          value={model.host}
          onChange={(event) => {
            setConfig((current) => ({
              ...current,
              [activeTarget]: { ...current[activeTarget], host: event.target.value },
            }));
          }}
        />
      </label>

      <label className="row">
        <span>Port</span>
        <input
          className="text-input"
          type="number"
          value={model.port}
          onChange={(event) => {
            setConfig((current) => ({
              ...current,
              [activeTarget]: {
                ...current[activeTarget],
                port: Number(event.target.value) || 39539,
              },
            }));
          }}
        />
      </label>

      <button
        type="button"
        onClick={() => {
          setConfig((current) => ({
            ...current,
            [activeTarget]: resetModelConfig(activeTarget),
          }));
        }}
      >
        Reset {TARGET_LABELS[activeTarget]} Defaults
      </button>

      <div className="mapping-table mapper-table">
        <div className="mapping-header">
          <span>Motion Key</span>
          <span>Parameter</span>
          <span>Transform</span>
        </div>
        {MOTION_STATE_KEYS.map((key) => (
          <div key={key} className="mapping-row mapper-row">
            <span>{key}</span>
            <input
              className="text-input"
              value={model.params[key]}
              placeholder="(skip)"
              onChange={(event) => {
                setConfig((current) => ({
                  ...current,
                  [activeTarget]: {
                    ...current[activeTarget],
                    params: {
                      ...current[activeTarget].params,
                      [key]: event.target.value,
                    },
                  },
                }));
              }}
            />
            <select
              value={model.transforms[key]}
              onChange={(event) => {
                setConfig((current) => ({
                  ...current,
                  [activeTarget]: {
                    ...current[activeTarget],
                    transforms: {
                      ...current[activeTarget].transforms,
                      [key]: event.target.value as ValueTransform,
                    },
                  },
                }));
              }}
            >
              {TRANSFORM_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <h2>Logger</h2>
      <label className="row">
        <span>Enabled</span>
        <input
          type="checkbox"
          checked={config.loggerEnabled}
          onChange={(event) => {
            setConfig((current) => ({
              ...current,
              loggerEnabled: event.target.checked,
            }));
          }}
        />
      </label>
      <label className="row">
        <span>Throttle (ms)</span>
        <input
          className="text-input"
          type="number"
          value={config.loggerThrottleMs}
          onChange={(event) => {
            setConfig((current) => ({
              ...current,
              loggerThrottleMs: Number(event.target.value) || 1000,
            }));
          }}
        />
      </label>

      <div className="adapter-actions">
        <button type="button" onClick={() => void onApply(config)}>
          Apply Mapper
        </button>

        <button
          type="button"
          onClick={() => {
            setExportJson(exportModelProfile(activeTarget, model));
          }}
        >
          Export {TARGET_LABELS[activeTarget]} Profile
        </button>
      </div>

      {exportJson ? <pre>{exportJson}</pre> : null}
    </section>
  );
}
