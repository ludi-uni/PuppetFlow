import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSourceConfig,
  setSourceConfig,
  type SourceConfig,
} from "../runtime";
import type { StatusKind } from "../components/StatusBanner";

export function sourcesDirty(draft: SourceConfig, applied: SourceConfig): boolean {
  return (
    draft.httpUrl !== applied.httpUrl ||
    draft.wsUrl !== applied.wsUrl ||
    draft.mqttBroker !== applied.mqttBroker ||
    draft.mqttTopic !== applied.mqttTopic
  );
}

export function isExternalInputActive(sources: SourceConfig): boolean {
  return Boolean(
    sources.httpUrl ||
    sources.wsUrl ||
    (sources.mqttBroker && sources.mqttTopic),
  );
}

export type HttpHealth = "unknown" | "ok" | "error" | "idle";

export interface UseInputSourcesOptions {
  notify: (message: string, kind?: StatusKind) => void;
}

export function useInputSources({ notify }: UseInputSourcesOptions) {
  const [httpUrl, setHttpUrl] = useState("");
  const [wsUrl, setWsUrl] = useState("");
  const [mqttBroker, setMqttBroker] = useState("");
  const [mqttTopic, setMqttTopic] = useState("");
  const [appliedSources, setAppliedSources] = useState<SourceConfig>(getSourceConfig());
  const [applyingSources, setApplyingSources] = useState(false);
  const [httpHealth, setHttpHealth] = useState<HttpHealth>("idle");

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
  const externalInputActive = isExternalInputActive(appliedSources);

  const syncFromRuntime = useCallback(() => {
    const sources = getSourceConfig();
    setAppliedSources(sources);
    setHttpUrl(sources.httpUrl ?? "");
    setWsUrl(sources.wsUrl ?? "");
    setMqttBroker(sources.mqttBroker ?? "");
    setMqttTopic(sources.mqttTopic ?? "");
  }, []);

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

  const handleApplySources = useCallback(async () => {
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
  }, [draftSources, notify]);

  return {
    httpUrl,
    setHttpUrl,
    wsUrl,
    setWsUrl,
    mqttBroker,
    setMqttBroker,
    mqttTopic,
    setMqttTopic,
    appliedSources,
    draftSources,
    sourcesHaveChanges,
    externalInputActive,
    applyingSources,
    httpHealth,
    syncFromRuntime,
    handleApplySources,
  };
}
