import type { MotionState } from "@puppetflow/core";
import type { PluginOutputSnapshot, StatefulEntrySnapshot } from "@puppetflow/runtime";
import { PipelineTab } from "../../components/PipelineTab";
import type { StatusKind } from "../../components/StatusBanner";
import type { MotionMapperEditorConfig } from "../../mapper-config";
import type { PresetName, SourceConfig } from "../../runtime";
import type { StudioMode, TabId } from "../../constants/studio-mode";
import { GraphTab } from "../expert/tabs/GraphTab";
import { PfScriptTab } from "../expert/tabs/PfScriptTab";
import { SourcesTab } from "../expert/tabs/SourcesTab";
import { MappingTab } from "../simple/tabs/MappingTab";
import { MapperTab } from "./tabs/MapperTab";
import { PluginsTab } from "./tabs/PluginsTab";
import { PresetsTab } from "./tabs/PresetsTab";
import { ScratchTab } from "./tabs/ScratchTab";

export interface StudioTabPanelProps {
  tab: TabId;
  isSimpleMode: boolean;
  notify: (message: string, kind?: StatusKind) => void;
  pipeline: {
    renderedMotion: MotionState;
    targetMotion: MotionState;
    phonemeInputSource: string;
    graphMouthMapped: boolean;
    externalInputActive: boolean;
    inputs: Record<string, number>;
    setInputs: (next: Record<string, number>) => void;
    channelInputs: Record<string, number>;
    setChannelInputs: (next: Record<string, number>) => void;
    phonemeChannel: string;
    setPhonemeChannel: (value: string) => void;
    emotionChannel: string;
    setEmotionChannel: (value: string) => void;
    emotionPluginEnabled: boolean;
    handleResetChannels: () => void;
    handlePushTimelinePhoneme: () => void;
    channelTableRows: Array<{ key: string; value: string }>;
    timelineTableRows: Array<{ key: string; value: string }>;
    timelineCurrentMs: number;
    stateSnapshot: Record<string, number>;
    behaviorPluginIds: string[];
    pipelineOutputs: PluginOutputSnapshot[];
    statefulSnapshot: StatefulEntrySnapshot[];
  };
  preset: {
    preset: PresetName;
    customPreset: boolean;
    applyingPreset: boolean;
    presetJson: string;
    behaviorJson: string;
    graphJson: string;
    behaviorPluginsJson: string;
    extensionsJson: string;
    assembledPresetJson: string;
    exportJson: string;
    graphEditorKey: number;
    pluginsHaveChanges: boolean;
    activePluginIds: string[];
    behaviorPreviewJson: string;
    setBehaviorPreviewJson: (json: string) => void;
    setPresetJson: (json: string) => void;
    setGraphJson: (json: string) => void;
    setBehaviorPluginsJson: (json: string) => void;
    setExtensionsJson: (json: string) => void;
    setExportJson: (json: string) => void;
    bumpGraphEditorKey: () => void;
    syncPresetParts: (json: string) => void;
    handleLoadBuiltinPreset: (presetName: PresetName) => void;
    handleDownloadPreset: () => void;
    handleImportPresetFile: (file: File | undefined) => void;
    selectBuiltinPresetDraft: (presetName: PresetName) => void;
    handleApplyPresetJson: () => void;
    handlePresetGraphChange: (nextGraphJson: string, merged: string) => void;
    applyMergedCustomPreset: (merged: string, message: string) => Promise<boolean>;
    updateBehaviorJson: (value: string) => void;
    updateGraphJson: (value: string) => void;
    updateBehaviorPluginsJson: (value: string) => void;
    updatePresetJson: (value: string) => void;
    handleLoadExportedPresetAndGoPipeline: () => void;
  };
  sources: {
    httpUrl: string;
    setHttpUrl: (value: string) => void;
    wsUrl: string;
    setWsUrl: (value: string) => void;
    mqttBroker: string;
    setMqttBroker: (value: string) => void;
    mqttTopic: string;
    setMqttTopic: (value: string) => void;
    appliedSources: SourceConfig;
    sourcesHaveChanges: boolean;
    applyingSources: boolean;
    handleApplySources: () => void;
  };
  mapper: {
    mapperEditorKey: number;
    appliedMapperConfig: MotionMapperEditorConfig;
    extensionCustomParamIds: string[];
    handleApplySimpleMapper: (config: MotionMapperEditorConfig) => Promise<void>;
    handleApplyExpertMapper: (config: MotionMapperEditorConfig) => Promise<void>;
  };
  onStudioModeChange: (mode: StudioMode) => void;
  onStayOnMapperTab: () => void;
}

export function StudioTabPanel({
  tab,
  isSimpleMode,
  notify,
  pipeline,
  preset,
  sources,
  mapper,
  onStudioModeChange,
  onStayOnMapperTab,
}: StudioTabPanelProps) {
  if (tab === "pipeline") {
    return (
      <PipelineTab
        isSimpleMode={isSimpleMode}
        renderedMotion={pipeline.renderedMotion}
        targetMotion={pipeline.targetMotion}
        phonemeInputSource={pipeline.phonemeInputSource}
        graphMouthMapped={pipeline.graphMouthMapped}
        externalInputActive={pipeline.externalInputActive}
        inputs={pipeline.inputs}
        onInputsChange={pipeline.setInputs}
        channelInputs={pipeline.channelInputs}
        onChannelInputsChange={pipeline.setChannelInputs}
        phonemeChannel={pipeline.phonemeChannel}
        onPhonemeChannelChange={pipeline.setPhonemeChannel}
        emotionChannel={pipeline.emotionChannel}
        onEmotionChannelChange={pipeline.setEmotionChannel}
        emotionPluginEnabled={pipeline.emotionPluginEnabled}
        onResetChannels={pipeline.handleResetChannels}
        onPushTimelinePhoneme={pipeline.handlePushTimelinePhoneme}
        channelTableRows={pipeline.channelTableRows}
        timelineTableRows={pipeline.timelineTableRows}
        timelineCurrentMs={pipeline.timelineCurrentMs}
        stateSnapshot={pipeline.stateSnapshot}
        behaviorPluginIds={pipeline.behaviorPluginIds}
        pipelineOutputs={pipeline.pipelineOutputs}
        statefulSnapshot={pipeline.statefulSnapshot}
      />
    );
  }

  if (tab === "scratch") {
    return (
      <ScratchTab
        isSimpleMode={isSimpleMode}
        assembledPresetJson={preset.assembledPresetJson}
        graphJson={preset.graphJson}
        behaviorPluginsJson={preset.behaviorPluginsJson}
        activePluginIds={preset.activePluginIds}
        behaviorPreviewJson={preset.behaviorPreviewJson}
        onPreviewJson={preset.setBehaviorPreviewJson}
        onApply={async (merged) => {
          await preset.applyMergedCustomPreset(
            merged,
            "Scratch から behavior を Preset に適用しました。",
          );
        }}
        onStatus={notify}
      />
    );
  }

  if (tab === "pfscript") {
    return (
      <PfScriptTab
        assembledPresetJson={preset.assembledPresetJson}
        applyingPreset={preset.applyingPreset}
        behaviorPreviewJson={preset.behaviorPreviewJson}
        onPreviewJson={preset.setBehaviorPreviewJson}
        onApply={async (merged) => {
          await preset.applyMergedCustomPreset(merged, "PFScript を Preset に適用しました。");
        }}
        onStatus={notify}
      />
    );
  }

  if (tab === "mapping") {
    return (
      <MappingTab
        presetJson={preset.presetJson}
        graphJson={preset.graphJson}
        applyingPreset={preset.applyingPreset}
        onGraphChange={(nextGraphJson, nextPresetJson) => {
          preset.setGraphJson(nextGraphJson);
          preset.setPresetJson(nextPresetJson);
          preset.bumpGraphEditorKey();
        }}
        onApply={() => {
          void preset.handleApplyPresetJson();
        }}
      />
    );
  }

  if (tab === "graph") {
    return (
      <GraphTab
        exportJson={preset.exportJson}
        assembledPresetJson={preset.assembledPresetJson}
        graphEditorKey={preset.graphEditorKey}
        activePluginIds={preset.activePluginIds}
        onPresetGraphChange={preset.handlePresetGraphChange}
        onExport={(json) => {
          preset.setExportJson(json);
          preset.setPresetJson(json);
          preset.syncPresetParts(json);
        }}
        onLoadExportedPreset={() => {
          void preset.handleLoadExportedPresetAndGoPipeline();
        }}
        onStatus={notify}
      />
    );
  }

  if (tab === "presets") {
    return (
      <PresetsTab
        isSimpleMode={isSimpleMode}
        preset={preset.preset}
        customPreset={preset.customPreset}
        applyingPreset={preset.applyingPreset}
        presetJson={preset.presetJson}
        behaviorJson={preset.behaviorJson}
        graphJson={preset.graphJson}
        behaviorPluginsJson={preset.behaviorPluginsJson}
        onLoadBuiltinPreset={(name) => {
          void preset.handleLoadBuiltinPreset(name);
        }}
        onDownloadPreset={preset.handleDownloadPreset}
        onImportPresetFile={(file) => {
          void preset.handleImportPresetFile(file);
        }}
        onSelectBuiltinDraft={preset.selectBuiltinPresetDraft}
        onApplyPresetJson={() => {
          void preset.handleApplyPresetJson();
        }}
        onUpdateBehaviorPluginsJson={preset.updateBehaviorPluginsJson}
        onUpdateBehaviorJson={preset.updateBehaviorJson}
        onUpdateGraphJson={preset.updateGraphJson}
        onUpdatePresetJson={preset.updatePresetJson}
      />
    );
  }

  if (tab === "plugins") {
    return (
      <PluginsTab
        isSimpleMode={isSimpleMode}
        emotionPluginEnabled={pipeline.emotionPluginEnabled}
        behaviorPluginsJson={preset.behaviorPluginsJson}
        extensionsJson={preset.extensionsJson}
        graphJson={preset.graphJson}
        presetJson={preset.presetJson}
        activePluginIds={preset.activePluginIds}
        pluginsHaveChanges={preset.pluginsHaveChanges}
        applyingPreset={preset.applyingPreset}
        onBehaviorPluginsJsonChange={preset.setBehaviorPluginsJson}
        onPresetJsonChange={preset.setPresetJson}
        onExtensionsChange={(nextExtensionsJson, nextPresetJson) => {
          preset.setExtensionsJson(nextExtensionsJson);
          preset.setPresetJson(nextPresetJson);
        }}
        onApplyPresetJson={() => {
          void preset.handleApplyPresetJson();
        }}
      />
    );
  }

  if (tab === "sources" && !isSimpleMode) {
    return (
      <SourcesTab
        httpUrl={sources.httpUrl}
        wsUrl={sources.wsUrl}
        mqttBroker={sources.mqttBroker}
        mqttTopic={sources.mqttTopic}
        appliedSources={sources.appliedSources}
        sourcesHaveChanges={sources.sourcesHaveChanges}
        applyingSources={sources.applyingSources}
        onHttpUrlChange={sources.setHttpUrl}
        onWsUrlChange={sources.setWsUrl}
        onMqttBrokerChange={sources.setMqttBroker}
        onMqttTopicChange={sources.setMqttTopic}
        onApplySources={() => {
          void sources.handleApplySources();
        }}
      />
    );
  }

  if (tab === "mapper") {
    return (
      <MapperTab
        isSimpleMode={isSimpleMode}
        mapperEditorKey={mapper.mapperEditorKey}
        appliedMapperConfig={mapper.appliedMapperConfig}
        activePluginIds={preset.activePluginIds}
        extensionCustomParamIds={mapper.extensionCustomParamIds}
        onApplySimpleMapper={mapper.handleApplySimpleMapper}
        onApplyExpertMapper={mapper.handleApplyExpertMapper}
        onStudioModeChange={onStudioModeChange}
        onStayOnMapperTab={onStayOnMapperTab}
      />
    );
  }

  return null;
}
