import type { MotionState } from "@puppetflow/core";
import type { PluginOutputSnapshot } from "@puppetflow/runtime";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ActiveConfigSummary } from "./components/ActiveConfigSummary";
import { HelpGuide } from "./components/HelpGuide";
import { KeyValueTable } from "./components/KeyValueTable";
import { MotionMapperEditor } from "./components/MotionMapperEditor";
import { NextStepBar } from "./components/NextStepBar";
import { ExtensionPackEditor } from "./components/ExtensionPackEditor";
import { PluginMotionEditor } from "./components/PluginMotionEditor";
import { SimpleGraphMappingEditor } from "./components/SimpleGraphMappingEditor";
import { SimpleOscMapperEditor } from "./components/SimpleOscMapperEditor";
import { SimplePresetPicker } from "./components/SimplePresetPicker";
import { StudioModeToggle } from "./components/StudioModeToggle";
import { MotionTable } from "./components/MotionTable";
import { MouthStatusBar } from "./components/MouthStatusBar";
import { PluginOutputsPanel } from "./components/PluginOutputsPanel";
import { StatusBanner, type StatusKind } from "./components/StatusBanner";
import { INPUT_SOURCE_PAYLOAD_EXAMPLE } from "./constants/input-sources";
import { presetHasMouthChannelMapping } from "./utils/graph-mouth-mapping";
import { resolvePhonemeInputSource } from "./utils/phoneme-source";
import {
  ensureRuntime,
  getRuntime,
  getActivePluginIds,
  getMapperConfig,
  getCurrentPreset,
  getBehaviorPluginIdsFromPresetJson,
  getPresetBehaviorPluginIds,
  getPresetJson,
  getSourceConfig,
  isCustomPresetActive,
  loadCustomPreset,
  type MotionPipelineUpdate,
  type PresetName,
  type SourceConfig,
  setMapperConfig,
  setSourceConfig,
  subscribeMotionPipeline,
  switchPreset,
} from "./runtime";
import {
  extractBehaviorJson,
  extractBehaviorPluginsJson,
  extractGraphJson,
  mergeBehaviorPart,
  mergeBehaviorPluginsPart,
  mergeGraphPart,
} from "./utils/preset-parts";
import { extractExtensionsJson } from "./utils/extension-config";
import { isPluginEnabled, mergeBehaviorPluginsIntoPreset } from "./utils/plugin-config";
import { resolveNextStep } from "./utils/next-step";
import { validatePresetJson } from "./utils/preset-validation";
import {
  getTabsForMode,
  loadStudioMode,
  normalizeTabForMode,
  saveStudioMode,
  type StudioMode,
  type TabId,
} from "./constants/studio-mode";

const ScratchEditor = lazy(() =>
  import("./components/ScratchEditor").then((module) => ({
    default: module.ScratchEditor,
  })),
);

const GraphEditor = lazy(() =>
  import("./components/GraphEditor").then((module) => ({
    default: module.GraphEditor,
  })),
);

const INPUT_SLIDERS = [
  { key: "interest", label: "Interest", simpleLabel: "興味・関心", defaultValue: 0.5 },
  { key: "energy", label: "Energy", simpleLabel: "元気", defaultValue: 0.5 },
  { key: "stress", label: "Stress", simpleLabel: "ストレス", defaultValue: 0.2 },
];

const CHANNEL_SLIDERS = [
  { key: "volume", label: "Volume", simpleLabel: "声の大きさ", defaultValue: 0 },
];

const PHONEME_OPTIONS = ["Rest", "A", "I", "U", "E", "O", "N"] as const;

const EMOTION_CHANNEL_OPTIONS = [
  { value: "", label: "（なし）" },
  { value: "joy", label: "joy" },
  { value: "sadness", label: "sadness" },
  { value: "anger", label: "anger" },
  { value: "curious", label: "curious" },
] as const;

const TIMELINE_PHONEME_MS = 150;

const PRESET_OPTIONS: PresetName[] = [
  "Curious",
  "Happy",
  "Idle",
  "Thinking",
  "Sleepy",
  "Focused",
];

function formatValue(value: number): string {
  return value.toFixed(3);
}

function sourcesDirty(draft: SourceConfig, applied: SourceConfig): boolean {
  return (
    draft.httpUrl !== applied.httpUrl ||
    draft.wsUrl !== applied.wsUrl ||
    draft.mqttBroker !== applied.mqttBroker ||
    draft.mqttTopic !== applied.mqttTopic
  );
}

export function App() {
  const [studioMode, setStudioMode] = useState<StudioMode>(() => loadStudioMode());
  const [tab, setTab] = useState<TabId>("pipeline");
  const [ready, setReady] = useState(false);
  const [preset, setPreset] = useState<PresetName>(getCurrentPreset());
  const [customPreset, setCustomPreset] = useState(isCustomPresetActive());
  const [inputs, setInputs] = useState<Record<string, number>>({
    interest: 0.5,
    energy: 0.5,
    stress: 0.2,
  });
  const [channelInputs, setChannelInputs] = useState<Record<string, number>>({
    volume: 0,
  });
  const [phonemeChannel, setPhonemeChannel] = useState<string>("Rest");
  const [emotionChannel, setEmotionChannel] = useState<string>("");
  const [graphEditorKey, setGraphEditorKey] = useState(0);
  const [channelSnapshot, setChannelSnapshot] = useState<
    Record<string, string | number | boolean>
  >({});
  const [activeTimelineEvents, setActiveTimelineEvents] = useState<
    MotionPipelineUpdate["activeTimelineEvents"]
  >([]);
  const [timelineCurrentMs, setTimelineCurrentMs] = useState(0);
  const [targetMotion, setTargetMotion] = useState<MotionState | null>(null);
  const [renderedMotion, setRenderedMotion] = useState<MotionState | null>(null);
  const [stateSnapshot, setStateSnapshot] = useState<Record<string, number>>({});
  const [presetJson, setPresetJson] = useState(getPresetJson("Curious"));
  const [behaviorJson, setBehaviorJson] = useState(
    extractBehaviorJson(getPresetJson("Curious")),
  );
  const [graphJson, setGraphJson] = useState(
    extractGraphJson(getPresetJson("Curious")),
  );
  const [behaviorPluginsJson, setBehaviorPluginsJson] = useState(
    extractBehaviorPluginsJson(getPresetJson("Curious")),
  );
  const [appliedBehaviorPluginsJson, setAppliedBehaviorPluginsJson] = useState(
    extractBehaviorPluginsJson(getPresetJson("Curious")),
  );
  const [extensionsJson, setExtensionsJson] = useState(
    extractExtensionsJson(getPresetJson("Curious")),
  );
  const [appliedExtensionsJson, setAppliedExtensionsJson] = useState(
    extractExtensionsJson(getPresetJson("Curious")),
  );
  const [activePluginIds, setActivePluginIds] =
    useState<string[]>(getActivePluginIds());
  const [behaviorPreviewJson, setBehaviorPreviewJson] = useState("");
  const [exportJson, setExportJson] = useState("");
  const [httpUrl, setHttpUrl] = useState("");
  const [wsUrl, setWsUrl] = useState("");
  const [mqttBroker, setMqttBroker] = useState("");
  const [mqttTopic, setMqttTopic] = useState("");
  const [appliedSources, setAppliedSources] = useState<SourceConfig>(getSourceConfig());
  const [pipelineOutputs, setPipelineOutputs] = useState<PluginOutputSnapshot[]>([]);
  const [behaviorPluginIds, setBehaviorPluginIds] = useState<string[]>(
    getPresetBehaviorPluginIds(getCurrentPreset()),
  );
  const [mapperEditorKey, setMapperEditorKey] = useState(0);
  const [appliedMapperConfig, setAppliedMapperConfig] = useState(getMapperConfig());
  const [httpHealth, setHttpHealth] = useState<"unknown" | "ok" | "error" | "idle">(
    "idle",
  );
  const [status, setStatus] = useState<{ kind: StatusKind; message: string } | null>(
    null,
  );
  const [applyingSources, setApplyingSources] = useState(false);
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

  const draftSources = useMemo<SourceConfig>(
    () => ({
      httpUrl: httpUrl.trim() || null,
      wsUrl: wsUrl.trim() || null,
      mqttBroker: mqttBroker.trim() || null,
      mqttTopic: mqttTopic.trim() || null,
    }),
    [httpUrl, wsUrl, mqttBroker, mqttTopic],
  );

  const sourcesHaveChanges = sourcesDirty(draftSources, appliedSources);
  const externalInputActive = Boolean(
    appliedSources.httpUrl ||
    appliedSources.wsUrl ||
    (appliedSources.mqttBroker && appliedSources.mqttTopic),
  );
  const pluginsHaveChanges =
    behaviorPluginsJson !== appliedBehaviorPluginsJson ||
    extensionsJson !== appliedExtensionsJson;
  const emotionPluginEnabled = isPluginEnabled(appliedBehaviorPluginsJson, "emotion");
  const graphMouthMapped = useMemo(
    () => presetHasMouthChannelMapping(presetJson),
    [presetJson],
  );
  const phonemeInputSource = useMemo(
    () => resolvePhonemeInputSource(activeTimelineEvents, channelSnapshot.phoneme),
    [activeTimelineEvents, channelSnapshot.phoneme],
  );
  const channelTableRows = useMemo(
    () =>
      Object.entries(channelSnapshot).map(([key, value]) => ({
        key,
        value: typeof value === "number" ? formatValue(value) : String(value),
      })),
    [channelSnapshot],
  );
  const timelineTableRows = useMemo(
    () =>
      activeTimelineEvents.map((event, index) => ({
        key: `${event.type} #${index + 1}`,
        value: `${event.startMs}–${event.endMs} ms · ${JSON.stringify(event.value)}`,
      })),
    [activeTimelineEvents],
  );

  const bumpGraphEditorKey = useCallback(() => {
    setGraphEditorKey((current) => current + 1);
  }, []);

  const tabs = useMemo(() => getTabsForMode(studioMode), [studioMode]);
  const isSimpleMode = studioMode === "simple";
  const nextStepGuide = useMemo(
    () =>
      resolveNextStep({
        mapperConfig: appliedMapperConfig,
        graphJson,
        pluginsHaveChanges,
      }),
    [appliedMapperConfig, graphJson, pluginsHaveChanges],
  );

  const handleStudioModeChange = useCallback((nextMode: StudioMode) => {
    saveStudioMode(nextMode);
    setStudioMode(nextMode);
    setTab((current) => normalizeTabForMode(current, nextMode));
  }, []);

  const notify = useCallback((message: string, kind: StatusKind = "info") => {
    setStatus({ kind, message });
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    void ensureRuntime()
      .then(() => {
        const instance = getRuntime();
        setTargetMotion(instance.getTargetMotion());
        setRenderedMotion(instance.getRenderedMotion());

        const sources = getSourceConfig();
        setAppliedSources(sources);
        setHttpUrl(sources.httpUrl ?? "");
        setWsUrl(sources.wsUrl ?? "");
        setMqttBroker(sources.mqttBroker ?? "");
        setMqttTopic(sources.mqttTopic ?? "");
        setAppliedMapperConfig(getMapperConfig());
        setBehaviorPluginIds(getPresetBehaviorPluginIds(getCurrentPreset()));
        setCustomPreset(isCustomPresetActive());

        unsubscribe = subscribeMotionPipeline(
          ({
            target,
            rendered,
            pluginOutputs: outputs,
            channels,
            activeTimelineEvents: events,
            timelineCurrentMs: currentMs,
          }) => {
            setTargetMotion(target);
            setRenderedMotion(rendered);
            setPipelineOutputs(outputs);
            setChannelSnapshot(channels);
            setActiveTimelineEvents(events);
            setTimelineCurrentMs(currentMs);
            setActivePluginIds(
              getRuntime()
                .getPlugins()
                .map((plugin) => plugin.id),
            );

            const liveSources = getSourceConfig();
            const receivingExternal = Boolean(
              liveSources.httpUrl ||
              liveSources.wsUrl ||
              (liveSources.mqttBroker && liveSources.mqttTopic),
            );
            if (receivingExternal) {
              const volume = channels.volume;
              if (typeof volume === "number") {
                setChannelInputs((current) => ({ ...current, volume }));
              }
              const phoneme = channels.phoneme;
              if (typeof phoneme === "string") {
                setPhonemeChannel(phoneme);
              }
              const emotion = channels.emotion;
              if (typeof emotion === "string") {
                setEmotionChannel(emotion);
              }
            }

            setStateSnapshot(
              Object.fromEntries(
                INPUT_SLIDERS.map((slider) => [
                  slider.key,
                  Number(getRuntime().state.get(slider.key) ?? slider.defaultValue),
                ]),
              ),
            );
          },
        );
        setReady(true);
      })
      .catch((error: unknown) => {
        setStartupError(
          error instanceof Error ? error.message : "ランタイムの起動に失敗しました。",
        );
      });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    void ensureRuntime().then((runtime) => {
      for (const slider of INPUT_SLIDERS) {
        runtime.state.set(slider.key, inputs[slider.key] ?? slider.defaultValue);
      }
      for (const slider of CHANNEL_SLIDERS) {
        runtime.channels.set(
          slider.key,
          channelInputs[slider.key] ?? slider.defaultValue,
        );
      }
      runtime.channels.set("phoneme", phonemeChannel);
      if (emotionPluginEnabled && emotionChannel) {
        runtime.channels.set("emotion", emotionChannel);
      } else {
        runtime.channels.delete("emotion");
      }
    });
  }, [
    inputs,
    channelInputs,
    phonemeChannel,
    emotionChannel,
    emotionPluginEnabled,
    ready,
  ]);

  const handleResetChannels = useCallback(() => {
    setChannelInputs({ volume: 0 });
    setPhonemeChannel("Rest");
    setEmotionChannel("");
    notify("Channel をリセットしました（volume=0, phoneme=Rest）。", "success");
  }, [notify]);

  const handlePushTimelinePhoneme = useCallback(() => {
    const runtime = getRuntime();
    const startMs = runtime.getTimelineCurrentMs();
    runtime.timeline.push({
      startMs,
      endMs: startMs + TIMELINE_PHONEME_MS,
      type: "phoneme",
      value: { phoneme: phonemeChannel, strength: 1 },
    });
    notify(
      `Timeline に音素 ${phonemeChannel} を送信（${startMs}–${startMs + TIMELINE_PHONEME_MS} ms）`,
      "success",
    );
  }, [notify, phonemeChannel]);

  useEffect(() => {
    if (!appliedSources.httpUrl) {
      setHttpHealth("idle");
      return;
    }

    let cancelled = false;

    const check = async () => {
      setHttpHealth("unknown");
      try {
        const response = await fetch(appliedSources.httpUrl!);
        if (!cancelled) {
          setHttpHealth(response.ok ? "ok" : "error");
        }
      } catch {
        if (!cancelled) {
          setHttpHealth("error");
        }
      }
    };

    void check();
    const intervalId = window.setInterval(() => {
      void check();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [appliedSources.httpUrl]);

  const handleApplySources = async () => {
    if (draftSources.mqttBroker && !draftSources.mqttTopic) {
      notify("MQTT を使う場合は Broker と Topic の両方を入力してください。", "error");
      return;
    }

    if (draftSources.mqttTopic && !draftSources.mqttBroker) {
      notify("MQTT Topic だけでは接続できません。Broker も入力してください。", "error");
      return;
    }

    setApplyingSources(true);
    try {
      await setSourceConfig(draftSources);
      setAppliedSources(draftSources);
      notify("Input Sources を適用しました。", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Input Sources の適用に失敗しました。",
        "error",
      );
    } finally {
      setApplyingSources(false);
    }
  };

  const handleApplyPresetJson = async () => {
    const validationError = validatePresetJson(presetJson);
    if (validationError) {
      notify(`Preset JSON が不正です: ${validationError}`, "error");
      return;
    }

    setApplyingPreset(true);
    try {
      await loadCustomPreset(presetJson);
      setCustomPreset(true);
      setBehaviorPluginIds(getBehaviorPluginIdsFromPresetJson(presetJson));
      setAppliedBehaviorPluginsJson(extractBehaviorPluginsJson(presetJson));
      setAppliedExtensionsJson(extractExtensionsJson(presetJson));
      setActivePluginIds(getActivePluginIds());
      bumpGraphEditorKey();
      notify("カスタム Preset を適用しました。", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Preset の適用に失敗しました。",
        "error",
      );
    } finally {
      setApplyingPreset(false);
    }
  };

  const syncPresetParts = (json: string) => {
    setBehaviorJson(extractBehaviorJson(json));
    setGraphJson(extractGraphJson(json));
    setBehaviorPluginsJson(extractBehaviorPluginsJson(json));
    setExtensionsJson(extractExtensionsJson(json));
  };

  const handleLoadBuiltinPreset = async (presetName: PresetName) => {
    setApplyingPreset(true);
    try {
      await switchPreset(presetName);
      const json = getPresetJson(presetName);
      setPreset(presetName);
      setPresetJson(json);
      syncPresetParts(json);
      setCustomPreset(false);
      setBehaviorPluginIds(getPresetBehaviorPluginIds(presetName));
      setAppliedBehaviorPluginsJson(extractBehaviorPluginsJson(json));
      setAppliedExtensionsJson(extractExtensionsJson(json));
      setActivePluginIds(getActivePluginIds());
      bumpGraphEditorKey();
      notify(`プリセット「${presetName}」を適用しました。`, "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "プリセットの切り替えに失敗しました。",
        "error",
      );
    } finally {
      setApplyingPreset(false);
    }
  };

  const handleDownloadPreset = () => {
    const validationError = validatePresetJson(presetJson);
    if (validationError) {
      notify(`ダウンロード前に JSON を修正してください: ${validationError}`, "error");
      return;
    }

    const blob = new Blob([presetJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${preset}.pfpreset`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Preset ファイルをダウンロードしました。", "success");
  };

  const handleImportPresetFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const validationError = validatePresetJson(text);
      if (validationError) {
        notify(`インポートした JSON が不正です: ${validationError}`, "error");
        return;
      }

      setPresetJson(text);
      syncPresetParts(text);
      notify(
        `${file.name} を読み込みました。「Preset を適用」でランタイムに反映できます。`,
        "success",
      );
    } catch {
      notify("ファイルの読み込みに失敗しました。", "error");
    }
  };

  const handleLoadExportedPreset = async () => {
    if (!exportJson) {
      return;
    }

    const validationError = validatePresetJson(exportJson);
    if (validationError) {
      notify(`エクスポート JSON が不正です: ${validationError}`, "error");
      return;
    }

    setApplyingPreset(true);
    try {
      await loadCustomPreset(exportJson);
      setPresetJson(exportJson);
      syncPresetParts(exportJson);
      setCustomPreset(true);
      setBehaviorPluginIds(getBehaviorPluginIdsFromPresetJson(exportJson));
      setAppliedBehaviorPluginsJson(extractBehaviorPluginsJson(exportJson));
      setAppliedExtensionsJson(extractExtensionsJson(exportJson));
      bumpGraphEditorKey();
      setTab("pipeline");
      notify("グラフからエクスポートした Preset を適用しました。", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Preset の適用に失敗しました。",
        "error",
      );
    } finally {
      setApplyingPreset(false);
    }
  };

  if (startupError) {
    return (
      <main className="studio">
        <p>Studio の起動に失敗しました。</p>
        <pre>{startupError}</pre>
      </main>
    );
  }

  if (!ready || !targetMotion || !renderedMotion) {
    return (
      <main className="studio">
        <p>Starting PuppetFlow Studio...</p>
      </main>
    );
  }

  return (
    <main className="studio">
      <header className="studio-header">
        <div>
          <h1>PuppetFlow Studio</h1>
          <p>
            {isSimpleMode
              ? "かんたんモード — キャラの動きを直感的に設定（描画は外部 Viewer）"
              : "パイプライン編集・監視ツール（キャラ描画は外部 Viewer で行います）"}
          </p>
        </div>
        <div className="studio-header-actions">
          <StudioModeToggle mode={studioMode} onChange={handleStudioModeChange} />
          <HelpGuide mode={studioMode} />
        </div>
      </header>

      {status ? (
        <StatusBanner
          kind={status.kind}
          message={status.message}
          onDismiss={() => setStatus(null)}
        />
      ) : null}

      {isSimpleMode ? (
        <NextStepBar
          guide={nextStepGuide}
          onGoToTab={() => setTab(nextStepGuide.tab)}
        />
      ) : null}

      {isSimpleMode ? (
        <details className="config-summary-details">
          <summary>設定の詳細を見る</summary>
          <ActiveConfigSummary
            preset={preset}
            isCustomPreset={customPreset}
            sources={appliedSources}
            behaviorPluginIds={behaviorPluginIds}
            pluginIds={activePluginIds}
            mapperConfig={appliedMapperConfig}
            httpHealth={httpHealth}
          />
        </details>
      ) : (
        <ActiveConfigSummary
          preset={preset}
          isCustomPreset={customPreset}
          sources={appliedSources}
          behaviorPluginIds={behaviorPluginIds}
          pluginIds={activePluginIds}
          mapperConfig={appliedMapperConfig}
          httpHealth={httpHealth}
        />
      )}

      <nav className="tabs" aria-label="Studio tabs">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "tab active" : "tab"}
            onClick={() => setTab(item.id)}
            title={item.description}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "pipeline" ? (
        <section className="preview-layout">
          <MouthStatusBar
            rendered={renderedMotion}
            phonemeSource={phonemeInputSource}
            graphMapped={graphMouthMapped}
            simpleMode={isSimpleMode}
          />
          {externalInputActive ? (
            <p className="external-input-banner">
              外部 Input Source から channels
              を受信中です。スライダーは受信値に同期します。
            </p>
          ) : null}
          <div className="panel-grid">
            <div className="pipeline-inputs">
              <section className="input-section">
                <h2>{isSimpleMode ? "キャラの気持ち" : "State（長寿命）"}</h2>
                <p className="hint">
                  {isSimpleMode
                    ? "スライダーを動かすとキャラの動きが変わります。"
                    : "interest / energy 等。秒〜分単位で変化する状態です。"}
                </p>
                {INPUT_SLIDERS.map((slider) => (
                  <label key={slider.key} className="row row-slider">
                    <span>{isSimpleMode ? slider.simpleLabel : slider.label}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={inputs[slider.key] ?? slider.defaultValue}
                      onChange={(e) =>
                        setInputs((c) => ({
                          ...c,
                          [slider.key]: Number(e.target.value),
                        }))
                      }
                    />
                    <span className="value">
                      {formatValue(inputs[slider.key] ?? slider.defaultValue)}
                    </span>
                  </label>
                ))}
              </section>

              <section className="input-section">
                <h2>{isSimpleMode ? "声・口の形" : "Channel（常時・sticky）"}</h2>
                <p className="hint">
                  {isSimpleMode
                    ? "リップシンクを使う場合は、声の大きさと口の形をここで試せます。"
                    : "値は保持されます。無音時は volume=0 / phoneme=Rest を送ってください。Graph の phonemeToShape（source=channel または auto）が参照します。"}
                </p>
                {CHANNEL_SLIDERS.map((slider) => (
                  <label key={slider.key} className="row row-slider">
                    <span>{isSimpleMode ? slider.simpleLabel : slider.label}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={channelInputs[slider.key] ?? slider.defaultValue}
                      onChange={(e) =>
                        setChannelInputs((c) => ({
                          ...c,
                          [slider.key]: Number(e.target.value),
                        }))
                      }
                    />
                    <span className="value">
                      {formatValue(channelInputs[slider.key] ?? slider.defaultValue)}
                    </span>
                  </label>
                ))}
                <label className="row">
                  <span>
                    {isSimpleMode ? "口の形（あいうえお）" : "Channel phoneme"}
                  </span>
                  <select
                    value={phonemeChannel}
                    onChange={(e) => setPhonemeChannel(e.target.value)}
                  >
                    {PHONEME_OPTIONS.map((phoneme) => (
                      <option key={phoneme} value={phoneme}>
                        {phoneme}
                      </option>
                    ))}
                  </select>
                </label>
                {emotionPluginEnabled ? (
                  <label className="row">
                    <span>emotion</span>
                    <select
                      value={emotionChannel}
                      onChange={(e) => setEmotionChannel(e.target.value)}
                    >
                      {EMOTION_CHANNEL_OPTIONS.map((option) => (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="channel-actions">
                  <button type="button" onClick={handleResetChannels}>
                    Channel をリセット
                  </button>
                </div>
              </section>

              {!isSimpleMode ? (
                <section className="input-section">
                  <h2>Timeline（一時イベント）</h2>
                  <p className="hint">
                    {TIMELINE_PHONEME_MS}ms の音素イベントを送ります。Graph の
                    phonemeToShape（auto / timeline）では Timeline が Channel
                    より優先されます。
                  </p>
                  <button type="button" onClick={handlePushTimelinePhoneme}>
                    タイムラインに音素を送る（{TIMELINE_PHONEME_MS}ms）
                  </button>
                </section>
              ) : (
                <section className="input-section">
                  <h2>口の動きを試す</h2>
                  <p className="hint">
                    選んだ口の形を短く送って、リップシンクの動きを確認できます。
                  </p>
                  <button type="button" onClick={handlePushTimelinePhoneme}>
                    口の形を一瞬送る（{TIMELINE_PHONEME_MS}ms）
                  </button>
                </section>
              )}
            </div>
            <div className="pipeline-inspectors">
              {!isSimpleMode ? (
                <>
                  <h2>Channel 一覧</h2>
                  <KeyValueTable
                    rows={channelTableRows}
                    emptyHint="（channel 未設定）"
                  />
                  <h2>Timeline 稼働中（{timelineCurrentMs} ms）</h2>
                  <KeyValueTable
                    rows={timelineTableRows}
                    emptyHint="（active イベントなし）"
                  />
                  <details className="inspector-details">
                    <summary>State JSON（詳細）</summary>
                    <pre>{JSON.stringify(stateSnapshot, null, 2)}</pre>
                  </details>
                  <details className="inspector-details">
                    <summary>
                      behaviorPlugins: {behaviorPluginIds.join(", ") || "(none)"}
                    </summary>
                  </details>
                </>
              ) : (
                <>
                  <h2>いまの動き</h2>
                  <MotionTable
                    columns={[
                      {
                        id: "rendered",
                        label: "キャラへの出力",
                        values: renderedMotion,
                      },
                    ]}
                  />
                  <p className="hint">
                    変化が見えないときは「キャラの雰囲気」「動きのつなぎ」「キャラへの送信」を確認してください。
                  </p>
                </>
              )}
            </div>
          </div>
          {!isSimpleMode ? (
            <>
              <div className="pipeline-motion">
                <h2>Motion (merged → rendered)</h2>
                <p className="hint">
                  Target は各段階のマージ結果。Rendered は modifier
                  適用後の最終出力です。
                </p>
                <MotionTable
                  columns={[
                    { id: "target", label: "Target", values: targetMotion },
                    { id: "rendered", label: "Rendered", values: renderedMotion },
                  ]}
                />
              </div>
              <div className="pipeline-stages">
                <h2>Pipeline Outputs</h2>
                <p className="hint">
                  behaviorPlugins / behavior / graph 各段階の MotionState（マージ前）。
                </p>
                <PluginOutputsPanel pluginOutputs={pipelineOutputs} />
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {tab === "scratch" ? (
        <Suspense fallback={<p className="hint">Scratch Editor を読み込み中…</p>}>
          <ScratchEditor
            presetJson={presetJson}
            activePluginIds={activePluginIds}
            onPreviewJson={setBehaviorPreviewJson}
            onApply={async (_behavior, merged) => {
              setPresetJson(merged);
              syncPresetParts(merged);
              setApplyingPreset(true);
              try {
                await loadCustomPreset(merged);
                setCustomPreset(true);
                setBehaviorPluginIds(getBehaviorPluginIdsFromPresetJson(merged));
                setActivePluginIds(getActivePluginIds());
                bumpGraphEditorKey();
                notify("Scratch から behavior を Preset に適用しました。", "success");
              } catch (error) {
                notify(
                  error instanceof Error
                    ? error.message
                    : "behavior の適用に失敗しました。",
                  "error",
                );
              } finally {
                setApplyingPreset(false);
              }
            }}
            onStatus={notify}
          />
          {!isSimpleMode && behaviorPreviewJson ? (
            <details className="scratch-preview">
              <summary>behavior JSON プレビュー</summary>
              <pre>{behaviorPreviewJson}</pre>
            </details>
          ) : null}
        </Suspense>
      ) : null}

      {tab === "mapping" ? (
        <SimpleGraphMappingEditor
          presetJson={presetJson}
          graphJson={graphJson}
          applying={applyingPreset}
          onGraphChange={(nextGraphJson, nextPresetJson) => {
            setGraphJson(nextGraphJson);
            setPresetJson(nextPresetJson);
            bumpGraphEditorKey();
          }}
          onApply={() => {
            void handleApplyPresetJson();
          }}
        />
      ) : null}

      {tab === "graph" ? (
        <Suspense fallback={<p className="hint">Graph Editor を読み込み中…</p>}>
          <GraphEditor
            exportJson={exportJson}
            presetJson={presetJson}
            presetGraphKey={graphEditorKey}
            activePluginIds={activePluginIds}
            onExport={(json) => {
              setExportJson(json);
              setPresetJson(json);
              syncPresetParts(json);
            }}
            onLoadExportedPreset={() => {
              void handleLoadExportedPreset();
            }}
            onStatus={notify}
          />
        </Suspense>
      ) : null}

      {tab === "presets" ? (
        <section className="preset-manager">
          {isSimpleMode ? (
            <SimplePresetPicker
              activePreset={preset}
              isCustomPreset={customPreset}
              applying={applyingPreset}
              onSelect={(presetName) => {
                void handleLoadBuiltinPreset(presetName);
              }}
              onDownload={handleDownloadPreset}
              onImportFile={(file) => {
                void handleImportPresetFile(file);
              }}
            />
          ) : (
            <>
              <label className="row">
                <span>Built-in Preset</span>
                <select
                  value={preset}
                  onChange={(e) => {
                    const next = e.target.value as PresetName;
                    const json = getPresetJson(next);
                    setPreset(next);
                    setPresetJson(json);
                    syncPresetParts(json);
                  }}
                >
                  {PRESET_OPTIONS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="preset-actions">
                <button
                  type="button"
                  disabled={applyingPreset}
                  onClick={() => {
                    void handleLoadBuiltinPreset(preset);
                  }}
                >
                  組み込み Preset を適用
                </button>
                <button type="button" onClick={handleDownloadPreset}>
                  .pfpreset をダウンロード
                </button>
                <label className="file-button">
                  ファイルからインポート
                  <input
                    type="file"
                    accept=".json,.pfpreset,application/json"
                    hidden
                    onChange={(event) => {
                      void handleImportPresetFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </>
          )}

          {!isSimpleMode ? (
            <>
              <div className="preset-split">
                <label className="preset-editor-label">
                  <span>behaviorPlugins（決められた動き）</span>
                  <textarea
                    className="preset-editor preset-editor-half"
                    value={behaviorPluginsJson}
                    onChange={(event) => {
                      const next = event.target.value;
                      setBehaviorPluginsJson(next);
                      try {
                        setPresetJson(mergeBehaviorPluginsPart(presetJson, next));
                      } catch {
                        // keep editing until JSON is valid
                      }
                    }}
                    spellCheck={false}
                  />
                </label>
                <label className="preset-editor-label">
                  <span>behavior（If / Assign）</span>
                  <textarea
                    className="preset-editor preset-editor-half"
                    value={behaviorJson}
                    onChange={(event) => {
                      const next = event.target.value;
                      setBehaviorJson(next);
                      try {
                        setPresetJson(mergeBehaviorPart(presetJson, next));
                      } catch {
                        // keep editing until JSON is valid
                      }
                    }}
                    spellCheck={false}
                  />
                </label>
                <label className="preset-editor-label">
                  <span>graph（数値ノードのみ）</span>
                  <textarea
                    className="preset-editor preset-editor-half"
                    value={graphJson}
                    onChange={(event) => {
                      const next = event.target.value;
                      setGraphJson(next);
                      try {
                        setPresetJson(mergeGraphPart(presetJson, next));
                      } catch {
                        // keep editing until JSON is valid
                      }
                    }}
                    spellCheck={false}
                  />
                </label>
              </div>

              <details className="preset-full-json">
                <summary>フル Preset JSON</summary>
                <textarea
                  className="preset-editor"
                  value={presetJson}
                  onChange={(event) => {
                    const next = event.target.value;
                    setPresetJson(next);
                    try {
                      syncPresetParts(next);
                    } catch {
                      // keep editing until JSON is valid
                    }
                  }}
                  spellCheck={false}
                />
              </details>

              <button
                type="button"
                className={customPreset ? "primary" : undefined}
                disabled={applyingPreset}
                onClick={() => {
                  void handleApplyPresetJson();
                }}
              >
                編集した Preset を適用
              </button>
              {customPreset ? (
                <p className="hint">カスタム Preset がランタイムに適用されています。</p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {tab === "plugins" ? (
        <section className="plugins-layout">
          <div>
            <h2>{isSimpleMode ? "オプション動き" : "追加プラグイン"}</h2>
            <p className="hint">
              {isSimpleMode
                ? "behaviorPlugins（視線・まばたき等）と extensions（考え込み・尻尾等）を編集します。変更後は下のボタンで反映してください。"
                : "behaviorPlugins で gaze/blink 等を、extensions で Motion Pack を編集します。変更は Preset に保存されます。"}
            </p>
            {emotionPluginEnabled || isPluginEnabled(behaviorPluginsJson, "emotion") ? (
              <p className="hint emotion-plugin-hint">
                Emotion プラグインは{isSimpleMode ? "動作確認" : "Pipeline"} タブの
                emotion を参照します。適用後、感情を選択してください。
              </p>
            ) : null}
            <PluginMotionEditor
              behaviorPluginsJson={behaviorPluginsJson}
              simpleMode={isSimpleMode}
              onChange={(nextBehaviorPluginsJson) => {
                setBehaviorPluginsJson(nextBehaviorPluginsJson);
                setPresetJson(
                  mergeBehaviorPluginsIntoPreset(presetJson, nextBehaviorPluginsJson),
                );
              }}
            />
            <ExtensionPackEditor
              presetJson={presetJson}
              extensionsJson={extensionsJson}
              graphJson={graphJson}
              simpleMode={isSimpleMode}
              onChange={(nextExtensionsJson, nextPresetJson) => {
                setExtensionsJson(nextExtensionsJson);
                setPresetJson(nextPresetJson);
              }}
            />
            <button
              type="button"
              className={pluginsHaveChanges ? "primary" : undefined}
              disabled={!pluginsHaveChanges || applyingPreset}
              onClick={() => {
                void handleApplyPresetJson();
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
      ) : null}

      {tab === "sources" && !isSimpleMode ? (
        <section className="input-sources-panel">
          <p className="hint">
            HTTP / WebSocket / MQTT から <strong>state / channels / timeline</strong> を
            JSON で注入します。フラットな <code>{`{ "interest": 0.8 }`}</code>{" "}
            形式（state のみ）も引き続き利用できます。変更後は「Apply
            Sources」で反映してください。
          </p>
          <label className="row">
            <span>HTTP URL</span>
            <input
              className="text-input"
              value={httpUrl}
              onChange={(e) => setHttpUrl(e.target.value)}
              placeholder="http://localhost:3000/input"
            />
          </label>
          <label className="row">
            <span>WebSocket URL</span>
            <input
              className="text-input"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              placeholder="ws://localhost:8080/input"
            />
          </label>
          <label className="row">
            <span>MQTT Broker</span>
            <input
              className="text-input"
              value={mqttBroker}
              onChange={(e) => setMqttBroker(e.target.value)}
              placeholder="mqtt://localhost:1883"
            />
          </label>
          <label className="row">
            <span>MQTT Topic</span>
            <input
              className="text-input"
              value={mqttTopic}
              onChange={(e) => setMqttTopic(e.target.value)}
              placeholder="puppetflow/input"
            />
          </label>
          <button
            type="button"
            className={sourcesHaveChanges ? "primary" : undefined}
            disabled={applyingSources || !sourcesHaveChanges}
            onClick={() => {
              void handleApplySources();
            }}
          >
            {applyingSources
              ? "適用中…"
              : sourcesHaveChanges
                ? "Apply Sources（未適用の変更あり）"
                : "Apply Sources"}
          </button>
          <h2>ペイロード例</h2>
          <pre className="payload-example">{INPUT_SOURCE_PAYLOAD_EXAMPLE}</pre>
          <h2>適用中の接続</h2>
          <pre>{JSON.stringify(appliedSources, null, 2)}</pre>
        </section>
      ) : null}

      {tab === "mapper" ? (
        isSimpleMode ? (
          <SimpleOscMapperEditor
            key={mapperEditorKey}
            initialConfig={getMapperConfig()}
            onApply={async (config) => {
              await setMapperConfig(config);
              setAppliedMapperConfig(getMapperConfig());
              setActivePluginIds(getActivePluginIds());
              setMapperEditorKey((current) => current + 1);
              notify("送信設定を反映しました。", "success");
            }}
            onOpenExpert={() => {
              handleStudioModeChange("expert");
              setTab("mapper");
            }}
          />
        ) : (
          <MotionMapperEditor
            key={mapperEditorKey}
            initialConfig={getMapperConfig()}
            activePluginIds={activePluginIds}
            onApply={async (config) => {
              await setMapperConfig(config);
              setAppliedMapperConfig(getMapperConfig());
              setActivePluginIds(getActivePluginIds());
              setMapperEditorKey((current) => current + 1);
              notify("Motion Mapper 設定を適用しました。", "success");
            }}
          />
        )
      ) : null}
    </main>
  );
}
