import type { MotionState } from "@puppetflow/core";
import { setTauriOscEnabled } from "@puppetflow/adapter-vmc";
import { useEffect, useState } from "react";
import {
  ensureRuntime,
  getRuntime,
  getCurrentPreset,
  getHttpSourceUrl,
  type PresetName,
  subscribeMotionPipeline,
  configureHttpSource,
  switchPreset,
} from "./runtime";

interface SliderConfig {
  key: string;
  label: string;
  defaultValue: number;
}

const INPUT_SLIDERS: SliderConfig[] = [
  { key: "interest", label: "Interest", defaultValue: 0.5 },
  { key: "energy", label: "Energy", defaultValue: 0.5 },
  { key: "stress", label: "Stress", defaultValue: 0.2 },
];

const OUTPUT_FIELDS: Array<{ key: keyof MotionState; label: string }> = [
  { key: "mouthX", label: "mouthX" },
  { key: "facePitch", label: "facePitch" },
  { key: "headTilt", label: "headTilt" },
  { key: "bodyLean", label: "bodyLean" },
  { key: "lookX", label: "lookX" },
];

const PRESET_OPTIONS: PresetName[] = [
  "Curious",
  "Happy",
  "Idle",
  "Thinking",
  "Sleepy",
  "Focused",
];

function formatValue(value: number): string {
  return value.toFixed(2);
}

function SliderRow({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string;
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="row">
      <span className="label">{label}</span>
      <input
        className="slider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        disabled={readOnly}
        onChange={(event) => onChange?.(Number(event.target.value))}
      />
      <span className="value">{formatValue(value)}</span>
    </label>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <pre className="json">{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const [preset, setPreset] = useState<PresetName>(getCurrentPreset());
  const [vmcEnabled, setVmcEnabled] = useState(true);
  const [httpUrl, setHttpUrl] = useState("");
  const [appliedHttpUrl, setAppliedHttpUrl] = useState<string | null>(
    getHttpSourceUrl(),
  );
  const [httpStatus, setHttpStatus] = useState<string | null>(null);
  const [applyingHttp, setApplyingHttp] = useState(false);
  const [inputs, setInputs] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      INPUT_SLIDERS.map((slider) => [slider.key, slider.defaultValue]),
    ),
  );
  const [targetMotion, setTargetMotion] = useState<MotionState | null>(null);
  const [renderedMotion, setRenderedMotion] = useState<MotionState | null>(null);
  const [stateSnapshot, setStateSnapshot] = useState<Record<string, number>>({});

  useEffect(() => {
    let unsubscribe = () => {};

    void ensureRuntime().then(() => {
      setTargetMotion(getRuntime().getTargetMotion());
      setRenderedMotion(getRuntime().getRenderedMotion());
      unsubscribe = subscribeMotionPipeline(({ target, rendered }) => {
        setTargetMotion(target);
        setRenderedMotion(rendered);
        setStateSnapshot(
          Object.fromEntries(
            INPUT_SLIDERS.map((slider) => [
              slider.key,
              Number(getRuntime().state.get(slider.key) ?? slider.defaultValue),
            ]),
          ),
        );
      });
      setReady(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    void ensureRuntime().then((runtime) => {
      for (const slider of INPUT_SLIDERS) {
        runtime.state.set(slider.key, inputs[slider.key] ?? slider.defaultValue);
      }
    });
  }, [inputs, ready]);

  useEffect(() => {
    setTauriOscEnabled(vmcEnabled);
  }, [vmcEnabled]);

  if (!ready || !targetMotion || !renderedMotion) {
    return (
      <main className="app">
        <p>Starting PuppetFlow runtime...</p>
      </main>
    );
  }

  return (
    <main className="app">
      <header>
        <h1>PuppetFlow Playground</h1>
        <p>State → Behavior → Motion Pipeline → Adapters（キャラ描画は外部 Viewer）</p>
        <p className="hint">
          フル機能の編集は PuppetFlow Studio（<code>pnpm dev:studio</code>
          ）を使ってください。
        </p>
      </header>

      {httpStatus ? (
        <p className={`http-status ${httpStatus.startsWith("失敗") ? "error" : "ok"}`}>
          {httpStatus}
        </p>
      ) : null}

      <section className="controls">
        <label className="control-row">
          <span>Preset</span>
          <select
            value={preset}
            onChange={(event) => {
              const next = event.target.value as PresetName;
              setPreset(next);
              void switchPreset(next);
            }}
          >
            {PRESET_OPTIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="control-row">
          <span>VMC Send</span>
          <input
            type="checkbox"
            checked={vmcEnabled}
            onChange={(event) => setVmcEnabled(event.target.checked)}
          />
        </label>

        <label className="control-row">
          <span>HTTP Source URL</span>
          <input
            className="text-input"
            type="url"
            placeholder="http://localhost:3000/state"
            value={httpUrl}
            onChange={(event) => setHttpUrl(event.target.value)}
          />
        </label>
        <button
          type="button"
          className={`apply-button${httpUrl.trim() !== (appliedHttpUrl ?? "") ? " dirty" : ""}`}
          disabled={applyingHttp || httpUrl.trim() === (appliedHttpUrl ?? "")}
          onClick={() => {
            setApplyingHttp(true);
            void configureHttpSource(httpUrl, httpUrl.trim().length > 0)
              .then(() => {
                const next = getHttpSourceUrl();
                setAppliedHttpUrl(next);
                setHttpStatus(
                  next
                    ? `HTTP Source を適用しました: ${next}`
                    : "HTTP Source を無効化しました。",
                );
              })
              .catch((error: unknown) => {
                setHttpStatus(
                  `失敗: ${error instanceof Error ? error.message : "HTTP Source の適用に失敗しました。"}`,
                );
              })
              .finally(() => {
                setApplyingHttp(false);
              });
          }}
        >
          {applyingHttp ? "適用中…" : "Apply HTTP Source"}
        </button>
        <p className="hint">
          HTTP source polls JSON like {'{ "interest": 0.8 }'}.
          {appliedHttpUrl ? ` 適用中: ${appliedHttpUrl}` : ""}
        </p>
      </section>

      <section>
        <h2>State Inputs</h2>
        {INPUT_SLIDERS.map((slider) => (
          <SliderRow
            key={slider.key}
            label={slider.label}
            value={inputs[slider.key] ?? slider.defaultValue}
            onChange={(value) => {
              setInputs((current) => ({ ...current, [slider.key]: value }));
            }}
          />
        ))}
      </section>

      <section>
        <h2>Motion Outputs (rendered)</h2>
        {OUTPUT_FIELDS.map((field) => (
          <SliderRow
            key={field.key}
            label={field.label}
            value={renderedMotion[field.key]}
            readOnly
          />
        ))}
      </section>

      <div className="inspectors">
        <JsonPanel title="State Inspector" value={stateSnapshot} />
        <JsonPanel title="Target Motion" value={targetMotion} />
        <JsonPanel title="Rendered Motion" value={renderedMotion} />
      </div>
    </main>
  );
}
