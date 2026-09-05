import type { MotionState } from "@puppetflow/core";
import type { PluginOutputSnapshot } from "@puppetflow/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHANNEL_SLIDERS,
  INPUT_SLIDERS,
  TIMELINE_PHONEME_MS,
} from "../constants/pipeline-sliders";
import { useCustomMicroBehaviors } from "./useCustomMicroBehaviors";
import { resolvePhonemeInputSource } from "../utils/phoneme-source";
import {
  applyStudioRuntimeInputs,
  ensureRuntime,
  getActivePluginIds,
  getSourceConfig,
  pushTimelinePhoneme,
  subscribeMotionPipeline,
  type MotionPipelineUpdate,
} from "../runtime";
import type { StatusKind } from "../components/StatusBanner";

function formatValue(value: number): string {
  return value.toFixed(3);
}

export function formatChannelTableRows(
  channelSnapshot: Record<string, string | number | boolean>,
): Array<{ key: string; value: string }> {
  return Object.entries(channelSnapshot).map(([key, value]) => ({
    key,
    value: typeof value === "number" ? formatValue(value) : String(value),
  }));
}

export function formatTimelineTableRows(
  activeTimelineEvents: MotionPipelineUpdate["activeTimelineEvents"],
): Array<{ key: string; value: string }> {
  return activeTimelineEvents.map((event, index) => ({
    key: `${event.type} #${index + 1}`,
    value: `${event.startMs}–${event.endMs} ms · ${JSON.stringify(event.value)}`,
  }));
}

function isReceivingExternalInput(
  sources: ReturnType<typeof getSourceConfig>,
): boolean {
  return Boolean(
    sources.httpUrl || sources.wsUrl || (sources.mqttBroker && sources.mqttTopic),
  );
}

export interface UseMotionPipelineOptions {
  emotionPluginEnabled: boolean;
  notify: (message: string, kind?: StatusKind) => void;
  onRuntimeReady?: () => void;
}

export function useMotionPipeline({
  emotionPluginEnabled,
  notify,
  onRuntimeReady,
}: UseMotionPipelineOptions) {
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
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
  const [activePluginIds, setActivePluginIds] =
    useState<string[]>(getActivePluginIds());
  const [pipelineOutputs, setPipelineOutputs] = useState<PluginOutputSnapshot[]>([]);
  const [statefulSnapshot, setStatefulSnapshot] = useState<
    MotionPipelineUpdate["statefulSnapshot"]
  >([]);
  const [microBehaviorSnapshot, setMicroBehaviorSnapshot] = useState<
    MotionPipelineUpdate["microBehavior"]
  >({
    status: { activeBehavior: null, remaining: 0 },
    queue: { queueLength: 0 },
    cooldowns: [],
  });

  const phonemeInputSource = useMemo(
    () => resolvePhonemeInputSource(activeTimelineEvents, channelSnapshot.phoneme),
    [activeTimelineEvents, channelSnapshot.phoneme],
  );

  const channelTableRows = useMemo(
    () => formatChannelTableRows(channelSnapshot),
    [channelSnapshot],
  );

  const timelineTableRows = useMemo(
    () => formatTimelineTableRows(activeTimelineEvents),
    [activeTimelineEvents],
  );

  const onRuntimeReadyRef = useRef(onRuntimeReady);
  onRuntimeReadyRef.current = onRuntimeReady;
  const runtimeReadyRef = useRef(false);

  const customMicroBehaviors = useCustomMicroBehaviors({ ready, notify });

  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};
    void ensureRuntime()
      .then(() => {
        if (disposed) return;

        unsubscribe = subscribeMotionPipeline(
          ({
            ready: runtimeReady,
            target,
            rendered,
            pluginOutputs: outputs,
            channels,
            activeTimelineEvents: events,
            timelineCurrentMs: currentMs,
            statefulSnapshot: statefulEntries,
            microBehavior,
            activePluginIds: pluginIds,
            stateSnapshot: nextStateSnapshot,
          }) => {
            if (disposed) return;
            setReady(runtimeReady);
            setTargetMotion(target);
            setRenderedMotion(rendered);
            setPipelineOutputs(outputs);
            setStatefulSnapshot(statefulEntries);
            setMicroBehaviorSnapshot(microBehavior);
            setChannelSnapshot(channels);
            setActiveTimelineEvents(events);
            setTimelineCurrentMs(currentMs);
            setActivePluginIds(pluginIds);
            setStateSnapshot(
              Object.fromEntries(
                INPUT_SLIDERS.map((slider) => [
                  slider.key,
                  Number(nextStateSnapshot[slider.key] ?? slider.defaultValue),
                ]),
              ),
            );

            if (runtimeReady && !runtimeReadyRef.current) {
              setStartupError(null);
              onRuntimeReadyRef.current?.();
            }
            runtimeReadyRef.current = runtimeReady;

            if (isReceivingExternalInput(getSourceConfig())) {
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
          },
        );
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setStartupError(
          error instanceof Error ? error.message : "ランタイムの起動に失敗しました。",
        );
      });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    applyStudioRuntimeInputs({
      state: Object.fromEntries(
        INPUT_SLIDERS.map((slider) => [
          slider.key,
          inputs[slider.key] ?? slider.defaultValue,
        ]),
      ),
      channels: {
        ...Object.fromEntries(
          CHANNEL_SLIDERS.map((slider) => [
            slider.key,
            channelInputs[slider.key] ?? slider.defaultValue,
          ]),
        ),
        phoneme: phonemeChannel,
        ...(emotionPluginEnabled && emotionChannel ? { emotion: emotionChannel } : {}),
      },
      removeChannels: emotionPluginEnabled && emotionChannel ? [] : ["emotion"],
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
    const range = pushTimelinePhoneme(phonemeChannel, TIMELINE_PHONEME_MS);
    if (!range) {
      notify("Runtimeが利用できないためTimelineへ送信できませんでした。", "error");
      return;
    }
    notify(
      `Timeline に音素 ${phonemeChannel} を送信（${range.startMs}–${range.endMs} ms）`,
      "success",
    );
  }, [notify, phonemeChannel]);

  return {
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
    channelSnapshot,
    activeTimelineEvents,
    timelineCurrentMs,
    targetMotion,
    renderedMotion,
    stateSnapshot,
    activePluginIds,
    setActivePluginIds,
    pipelineOutputs,
    statefulSnapshot,
    microBehaviorSnapshot,
    phonemeInputSource,
    channelTableRows,
    timelineTableRows,
    handleResetChannels,
    handlePushTimelinePhoneme,
    handleTriggerMicroBehavior: customMicroBehaviors.handleTriggerBehavior,
    customBehaviorIds: customMicroBehaviors.customBehaviorIds,
    selectedCustomBehaviorId: customMicroBehaviors.selectedCustomId,
    editorDraft: customMicroBehaviors.editorDraft,
    customBehaviorEditorJson: customMicroBehaviors.editorJson,
    customBehaviorEditorError: customMicroBehaviors.editorError,
    setCustomBehaviorEditorJson: customMicroBehaviors.setEditorJson,
    selectCustomBehavior: customMicroBehaviors.selectCustomBehavior,
    handleDraftChange: customMicroBehaviors.handleDraftChange,
    handleSyncJsonFromDraft: customMicroBehaviors.handleSyncJsonFromDraft,
    handleSyncDraftFromJson: customMicroBehaviors.handleSyncDraftFromJson,
    handleAddCustomBehavior: customMicroBehaviors.handleAddCustomBehavior,
    handleAddFromTemplate: customMicroBehaviors.handleAddFromTemplate,
    handleDeleteCustomBehavior: customMicroBehaviors.handleDeleteCustomBehavior,
    handleApplyCustomBehavior: customMicroBehaviors.handleApplyCustomBehavior,
    handleTestCustomBehavior: customMicroBehaviors.handleTestCustomBehavior,
    handleExportCustomBehaviors: customMicroBehaviors.handleExportCustomBehaviors,
    handleImportCustomBehaviors: customMicroBehaviors.handleImportCustomBehaviors,
    customMicroBehaviorCount: customMicroBehaviors.customBehaviors.length,
  };
}
