import { useCallback, useState } from "react";
import { StudioChrome } from "./features/shared/StudioChrome";
import { StudioTabPanel } from "./features/shared/StudioTabPanel";
import { usePresetState } from "./hooks/usePresetState";
import { useMotionPipeline } from "./hooks/useMotionPipeline";
import { useInputSources } from "./hooks/useInputSources";
import { useActing } from "./hooks/useActing";
import { useMapperConfig } from "./hooks/useMapperConfig";
import { useStudioMode } from "./hooks/useStudioMode";
import { useStudioStatus } from "./hooks/useStudioStatus";
import { useStudioNextStep } from "./hooks/useStudioNextStep";
import {
  getSharedHostEndpoint,
  getStudioExecutionMode,
  type SharedHostConfig,
} from "./execution-mode";
import { ActingTab } from "./features/shared/tabs/ActingTab";
import {
  getCurrentPreset,
  getPresetBehaviorPluginIds,
  isCustomPresetActive,
} from "./runtime";
import { isPluginEnabled } from "./utils/plugin-config";
import { exportStudioCliConfig } from "./utils/export-cli-config";
import {
  loadCustomMicroBehaviors,
  serializeCustomMicroBehaviorsForExport,
} from "./utils/custom-micro-behaviors";

function LocalStudio() {
  const {
    studioMode,
    tab,
    setTab,
    goToTab,
    tabs,
    blocklyEnabled,
    isSimpleMode,
    handleStudioModeChange,
    setBlocklyEnabled,
  } = useStudioMode();
  const { status, notify, dismissStatus, behaviorPreviewJson, setBehaviorPreviewJson } =
    useStudioStatus();

  const inputSources = useInputSources({ notify });
  const presetState = usePresetState({ notify });

  const {
    preset,
    customPreset,
    setCustomPreset,
    presetJson,
    setPresetJson,
    behaviorJson,
    graphJson,
    setGraphJson,
    behaviorPluginsJson,
    setBehaviorPluginsJson,
    extensionsJson,
    setExtensionsJson,
    behaviorPluginIds,
    setBehaviorPluginIds,
    graphEditorKey,
    exportJson,
    setExportJson,
    applyingPreset,
    pluginsHaveChanges,
    appliedBehaviorPluginsJson,
    graphMouthMapped,
    assembledPresetJson,
    syncPresetParts,
    bumpGraphEditorKey,
    handleApplyPresetJson,
    handleLoadBuiltinPreset,
    handleDownloadPreset,
    handleImportPresetFile,
    handleLoadExportedPreset,
    handlePresetGraphChange,
    selectBuiltinPresetDraft,
    applyMergedCustomPreset,
    updateBehaviorJson,
    updateGraphJson,
    updateBehaviorPluginsJson,
    updatePresetJson,
  } = presetState;

  const mapperConfigState = useMapperConfig({
    notify,
    assembledPresetJson,
    extensionsJson,
  });

  const {
    mapperEditorKey,
    appliedMapperConfig,
    extensionCustomParamIds,
    syncFromRuntime: syncMapperFromRuntime,
    handleApplySimpleMapper,
    handleApplyExpertMapper,
  } = mapperConfigState;

  const {
    httpUrl,
    setHttpUrl,
    wsUrl,
    setWsUrl,
    mqttBroker,
    setMqttBroker,
    mqttTopic,
    setMqttTopic,
    appliedSources,
    sourcesHaveChanges,
    externalInputActive,
    applyingSources,
    httpHealth,
    syncFromRuntime: syncSourcesFromRuntime,
    handleApplySources,
  } = inputSources;

  const emotionPluginEnabled = isPluginEnabled(appliedBehaviorPluginsJson, "emotion");

  const handleRuntimeReady = useCallback(() => {
    syncSourcesFromRuntime();
    syncMapperFromRuntime();
    setBehaviorPluginIds(getPresetBehaviorPluginIds(getCurrentPreset()));
    setCustomPreset(isCustomPresetActive());
  }, [
    setBehaviorPluginIds,
    setCustomPreset,
    syncMapperFromRuntime,
    syncSourcesFromRuntime,
  ]);

  const motionPipeline = useMotionPipeline({
    emotionPluginEnabled,
    notify,
    onRuntimeReady: handleRuntimeReady,
  });

  const {
    ready,
    startupError,
    inputs,
    setInputs,
    channelInputs,
    setChannelInputs,
    phonemeChannel,
    setPhonemeChannel,
    emotionChannel,
    setEmotionChannel,
    timelineCurrentMs,
    targetMotion,
    renderedMotion,
    stateSnapshot,
    activePluginIds,
    pipelineOutputs,
    statefulSnapshot,
    microBehaviorSnapshot,
    phonemeInputSource,
    channelTableRows,
    timelineTableRows,
    handleResetChannels,
    handlePushTimelinePhoneme,
    handleTriggerMicroBehavior,
    customBehaviorIds,
    selectedCustomBehaviorId,
    editorDraft,
    customBehaviorEditorJson,
    customBehaviorEditorError,
    setCustomBehaviorEditorJson,
    selectCustomBehavior,
    handleDraftChange,
    handleSyncJsonFromDraft,
    handleSyncDraftFromJson,
    handleAddCustomBehavior,
    handleAddFromTemplate,
    handleDeleteCustomBehavior,
    handleApplyCustomBehavior,
    handleTestCustomBehavior,
    handleExportCustomBehaviors,
    handleImportCustomBehaviors,
    customMicroBehaviorCount,
  } = motionPipeline;
  const acting = useActing();

  const nextStepGuide = useStudioNextStep({
    mapperConfig: appliedMapperConfig,
    graphJson,
    pluginsHaveChanges,
    assembledPresetJson,
  });

  const handleLoadExportedPresetAndGoPipeline = useCallback(async () => {
    const applied = await handleLoadExportedPreset();
    if (applied) {
      goToTab("pipeline");
    }
  }, [goToTab, handleLoadExportedPreset]);

  const handleExportCliConfig = useCallback(async () => {
    const result = await exportStudioCliConfig({
      preset,
      isCustomPreset: customPreset,
      presetJson: customPreset ? presetJson : undefined,
      sources: appliedSources,
      mapperConfig: appliedMapperConfig,
      initialState: inputs,
      customMicroBehaviorsJson:
        customMicroBehaviorCount > 0
          ? serializeCustomMicroBehaviorsForExport(loadCustomMicroBehaviors())
          : undefined,
    });

    if (result.cancelled) {
      return;
    }

    if (!result.saved) {
      notify("CLI 設定の保存に失敗しました。", "error");
      return;
    }

    if (result.downloadedPreset && result.usedDirectoryPicker) {
      notify(
        result.downloadedMicroBehaviors
          ? "選択したフォルダに puppetflow.yaml、Preset、micro-behaviors.pfmicrobehaviors を保存しました。`pnpm pf run --config puppetflow.yaml` で起動できます。"
          : "選択したフォルダに puppetflow.yaml と Preset を保存しました。`pnpm pf run --config puppetflow.yaml` で起動できます。",
        "success",
      );
      return;
    }

    if (result.downloadedPreset || result.downloadedMicroBehaviors) {
      notify(
        "puppetflow.yaml と関連ファイルを保存しました。同じフォルダに置いて `pnpm pf run --config puppetflow.yaml` で起動できます。",
        "success",
      );
      return;
    }

    notify(
      "puppetflow.yaml を保存しました。`pnpm pf run --config puppetflow.yaml` で起動できます。",
      "success",
    );
  }, [
    appliedMapperConfig,
    appliedSources,
    customPreset,
    inputs,
    notify,
    preset,
    presetJson,
    customMicroBehaviorCount,
  ]);

  const handleBlocklyEnabledChange = useCallback(
    (enabled: boolean) => {
      if (
        !enabled &&
        tab === "scratch" &&
        !window.confirm(
          "Blocklyを無効にすると、Presetへ未適用の編集内容が失われる可能性があります。無効にしますか？",
        )
      ) {
        return;
      }
      setBlocklyEnabled(enabled);
    },
    [setBlocklyEnabled, tab],
  );

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
      <StudioChrome
        studioMode={studioMode}
        isSimpleMode={isSimpleMode}
        tab={tab}
        blocklyEnabled={blocklyEnabled}
        tabs={tabs}
        status={status}
        nextStepGuide={nextStepGuide}
        preset={preset}
        customPreset={customPreset}
        appliedSources={appliedSources}
        behaviorPluginIds={behaviorPluginIds}
        activePluginIds={activePluginIds}
        appliedMapperConfig={appliedMapperConfig}
        httpHealth={httpHealth}
        onStudioModeChange={handleStudioModeChange}
        onBlocklyEnabledChange={handleBlocklyEnabledChange}
        onDismissStatus={dismissStatus}
        onGoToNextStepTab={() => goToTab(nextStepGuide.tab)}
        onSelectTab={setTab}
        onExportCliConfig={handleExportCliConfig}
      />

      <StudioTabPanel
        tab={tab}
        isSimpleMode={isSimpleMode}
        blocklyEnabled={blocklyEnabled}
        notify={notify}
        pipeline={{
          renderedMotion,
          targetMotion,
          phonemeInputSource,
          graphMouthMapped,
          externalInputActive,
          inputs,
          setInputs,
          channelInputs,
          setChannelInputs,
          phonemeChannel,
          setPhonemeChannel,
          emotionChannel,
          setEmotionChannel,
          emotionPluginEnabled,
          handleResetChannels,
          handlePushTimelinePhoneme,
          channelTableRows,
          timelineTableRows,
          timelineCurrentMs,
          stateSnapshot,
          behaviorPluginIds,
          pipelineOutputs,
          statefulSnapshot,
          microBehaviorSnapshot,
          handleTriggerMicroBehavior,
          customBehaviorIds,
          selectedCustomBehaviorId,
          editorDraft,
          customBehaviorEditorJson,
          customBehaviorEditorError,
          setCustomBehaviorEditorJson,
          selectCustomBehavior,
          handleDraftChange,
          handleSyncJsonFromDraft,
          handleSyncDraftFromJson,
          handleAddCustomBehavior,
          handleAddFromTemplate,
          handleDeleteCustomBehavior,
          handleApplyCustomBehavior,
          handleTestCustomBehavior,
          handleExportCustomBehaviors,
          handleImportCustomBehaviors,
        }}
        preset={{
          preset,
          customPreset,
          applyingPreset,
          presetJson,
          behaviorJson,
          graphJson,
          behaviorPluginsJson,
          extensionsJson,
          assembledPresetJson,
          exportJson,
          graphEditorKey,
          pluginsHaveChanges,
          activePluginIds,
          behaviorPreviewJson,
          setBehaviorPreviewJson,
          setPresetJson,
          setGraphJson,
          setBehaviorPluginsJson,
          setExtensionsJson,
          setExportJson,
          bumpGraphEditorKey,
          syncPresetParts,
          handleLoadBuiltinPreset: (name) => {
            void handleLoadBuiltinPreset(name);
          },
          handleDownloadPreset,
          handleImportPresetFile: (file) => {
            void handleImportPresetFile(file);
          },
          selectBuiltinPresetDraft,
          handleApplyPresetJson: () => {
            void handleApplyPresetJson();
          },
          handlePresetGraphChange,
          applyMergedCustomPreset,
          updateBehaviorJson,
          updateGraphJson,
          updateBehaviorPluginsJson,
          updatePresetJson,
          handleLoadExportedPresetAndGoPipeline: () => {
            void handleLoadExportedPresetAndGoPipeline();
          },
        }}
        sources={{
          httpUrl,
          setHttpUrl,
          wsUrl,
          setWsUrl,
          mqttBroker,
          setMqttBroker,
          mqttTopic,
          setMqttTopic,
          appliedSources,
          sourcesHaveChanges,
          applyingSources,
          handleApplySources,
        }}
        mapper={{
          mapperEditorKey,
          appliedMapperConfig,
          extensionCustomParamIds,
          handleApplySimpleMapper,
          handleApplyExpertMapper,
        }}
        acting={acting}
        onStudioModeChange={handleStudioModeChange}
        onStayOnMapperTab={() => goToTab("mapper")}
      />
    </main>
  );
}

function SharedStudio() {
  const baseUrl = getSharedHostEndpoint();
  const [tokenInput, setTokenInput] = useState("");
  const [sharedHost, setSharedHost] = useState<SharedHostConfig | null>(null);
  const acting = useActing({ sharedHost });

  return (
    <main className="studio">
      <header className="studio-header">
        <div>
          <h1>PuppetFlow Studio</h1>
          <p>Shared Host mode — Acting / Expression only</p>
        </div>
      </header>
      <section className="config-summary" aria-label="Shared Host connection">
        <p>Shared Host endpoint: {baseUrl ?? "not configured"}</p>
        <p>Connection: {acting.ready ? "ready" : "disconnected"}</p>
        <p>Host instance: {acting.hostInstanceId ?? "unavailable"}</p>
        <label htmlFor="shared-host-token">
          Connection token
          <input
            id="shared-host-token"
            type="password"
            autoComplete="off"
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!baseUrl || !tokenInput.trim()}
          onClick={() => {
            if (!baseUrl || !tokenInput.trim()) return;
            setSharedHost({ baseUrl, token: tokenInput });
            setTokenInput("");
          }}
        >
          Connect
        </button>
        <button
          type="button"
          disabled={!sharedHost}
          onClick={() => {
            setSharedHost(null);
            setTokenInput("");
          }}
        >
          Disconnect
        </button>
        <p className="hint">
          Preset, Mapper, Source, Timeline, and Micro Behavior editing are unavailable
          in shared mode.
        </p>
      </section>
      <ActingTab {...acting} />
    </main>
  );
}

export function App() {
  return getStudioExecutionMode() === "shared" ? <SharedStudio /> : <LocalStudio />;
}
