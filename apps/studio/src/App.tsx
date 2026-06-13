import type { MotionState } from "@puppetflow/core";
import type { PluginOutputSnapshot } from "@puppetflow/runtime";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ActiveConfigSummary } from "./components/ActiveConfigSummary";
import { HelpGuide } from "./components/HelpGuide";
import { MotionMapperEditor } from "./components/MotionMapperEditor";
import { NextStepBar } from "./components/NextStepBar";
import { ExtensionPackEditor } from "./components/ExtensionPackEditor";
import { PluginMotionEditor } from "./components/PluginMotionEditor";
import { SimpleGraphMappingEditor } from "./components/SimpleGraphMappingEditor";
import { SimpleOscMapperEditor } from "./components/SimpleOscMapperEditor";
import { SimplePresetPicker } from "./components/SimplePresetPicker";
import { StudioModeToggle } from "./components/StudioModeToggle";
import { PipelineTab } from "./components/PipelineTab";
import { StatusBanner, type StatusKind } from "./components/StatusBanner";
import { INPUT_SOURCE_PAYLOAD_EXAMPLE } from "./constants/input-sources";
import { CHANNEL_SLIDERS, INPUT_SLIDERS } from "./constants/pipeline-sliders";
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
  assemblePresetFromParts,
  extractBehaviorJson,
  extractBehaviorPluginsJson,
  extractGraphJson,
  mergeBehaviorPart,
  mergeBehaviorPluginsPart,
  mergeGraphPart,
} from "./utils/preset-parts";
import { applyPresetToStudio } from "./services/presetApply";
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

const PfScriptEditor = lazy(() =>
  import("./components/PfScriptEditor").then((module) => ({
    default: module.PfScriptEditor,
  })),
);

const PRESET_OPTIONS: PresetName[] = [
  "Curious",
  "Happy",
  "Idle",
  "Thinking",
  "Sleepy",
  "Focused",
];

import { TIMELINE_PHONEME_MS } from "./constants/pipeline-sliders";

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
  const assembledPresetJson = useMemo(
    () =>
      assemblePresetFromParts(presetJson, {
        graphJson,
        behaviorPluginsJson,
        extensionsJson,
      }),
    [presetJson, graphJson, behaviorPluginsJson, extensionsJson],
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

  const handlePresetGraphChange = useCallback((nextGraphJson: string, merged: string) => {
    setGraphJson(nextGraphJson);
    setPresetJson(merged);
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

  const syncPresetParts = (json: string) => {
    setBehaviorJson(extractBehaviorJson(json));
    setGraphJson(extractGraphJson(json));
    setBehaviorPluginsJson(extractBehaviorPluginsJson(json));
    setExtensionsJson(extractExtensionsJson(json));
  };

  const presetApplySync = {
    setPresetJson,
    setCustomPreset,
    syncPresetParts,
    setBehaviorPluginIds,
    setAppliedBehaviorPluginsJson,
    setAppliedExtensionsJson,
    setActivePluginIds,
    bumpGraphEditorKey,
    setPreset,
  };

  const runPresetApply = (
    json: string,
    custom: boolean,
    successMessage: string,
    reloadRuntime: () => Promise<unknown>,
    presetName?: PresetName,
  ) =>
    applyPresetToStudio({
      json,
      custom,
      successMessage,
      presetName,
      reloadRuntime,
      getBehaviorPluginIdsFromJson: getBehaviorPluginIdsFromPresetJson,
      getActivePluginIds,
      extractBehaviorPluginsJson,
      extractExtensionsJson,
      sync: presetApplySync,
      setApplying: setApplyingPreset,
      notify,
    });

  const handleApplyPresetJson = async () => {
    const validationError = validatePresetJson(presetJson);
    if (validationError) {
      notify(`Preset JSON が不正です: ${validationError}`, "error");
      return;
    }

    await runPresetApply(
      presetJson,
      true,
      "カスタム Preset を適用しました。",
      () => loadCustomPreset(presetJson),
    );
  };

  const handleLoadBuiltinPreset = async (presetName: PresetName) => {
    const json = getPresetJson(presetName);
    await runPresetApply(
      json,
      false,
      `プリセット「${presetName}」を適用しました。`,
      () => switchPreset(presetName),
      presetName,
    );
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
        <PipelineTab
          isSimpleMode={isSimpleMode}
          renderedMotion={renderedMotion}
          targetMotion={targetMotion}
          phonemeInputSource={phonemeInputSource}
          graphMouthMapped={graphMouthMapped}
          externalInputActive={externalInputActive}
          inputs={inputs}
          onInputsChange={setInputs}
          channelInputs={channelInputs}
          onChannelInputsChange={setChannelInputs}
          phonemeChannel={phonemeChannel}
          onPhonemeChannelChange={setPhonemeChannel}
          emotionChannel={emotionChannel}
          onEmotionChannelChange={setEmotionChannel}
          emotionPluginEnabled={emotionPluginEnabled}
          onResetChannels={handleResetChannels}
          onPushTimelinePhoneme={handlePushTimelinePhoneme}
          channelTableRows={channelTableRows}
          timelineTableRows={timelineTableRows}
          timelineCurrentMs={timelineCurrentMs}
          stateSnapshot={stateSnapshot}
          behaviorPluginIds={behaviorPluginIds}
          pipelineOutputs={pipelineOutputs}
        />
      ) : null}

      {tab === "scratch" ? (
        <Suspense fallback={<p className="hint">Scratch Editor を読み込み中…</p>}>
          <ScratchEditor
            presetJson={assembledPresetJson}
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
                setAppliedBehaviorPluginsJson(extractBehaviorPluginsJson(merged));
                setAppliedExtensionsJson(extractExtensionsJson(merged));
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

      {tab === "pfscript" ? (
        <Suspense fallback={<p className="hint">PFScript Editor を読み込み中…</p>}>
          <PfScriptEditor
            presetJson={assembledPresetJson}
            applying={applyingPreset}
            onPreviewJson={setBehaviorPreviewJson}
            onApply={async (merged) => {
              setPresetJson(merged);
              syncPresetParts(merged);
              setApplyingPreset(true);
              try {
                await loadCustomPreset(merged);
                setCustomPreset(true);
                setBehaviorPluginIds(getBehaviorPluginIdsFromPresetJson(merged));
                setAppliedBehaviorPluginsJson(extractBehaviorPluginsJson(merged));
                setAppliedExtensionsJson(extractExtensionsJson(merged));
                setActivePluginIds(getActivePluginIds());
                bumpGraphEditorKey();
                notify("PFScript を Preset に適用しました。", "success");
              } catch (error) {
                notify(
                  error instanceof Error
                    ? error.message
                    : "PFScript Preset の適用に失敗しました。",
                  "error",
                );
              } finally {
                setApplyingPreset(false);
              }
            }}
            onStatus={notify}
          />
          {behaviorPreviewJson ? (
            <details className="pfscript-preview">
              <summary>behavior JSON（App プレビュー）</summary>
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
            presetJson={assembledPresetJson}
            presetGraphKey={graphEditorKey}
            activePluginIds={activePluginIds}
            onPresetGraphChange={handlePresetGraphChange}
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
