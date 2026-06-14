import { INPUT_SOURCE_PAYLOAD_EXAMPLE } from "../../../constants/input-sources";
import type { SourceConfig } from "../../../runtime";

export interface SourcesTabProps {
  httpUrl: string;
  wsUrl: string;
  mqttBroker: string;
  mqttTopic: string;
  appliedSources: SourceConfig;
  sourcesHaveChanges: boolean;
  applyingSources: boolean;
  onHttpUrlChange: (value: string) => void;
  onWsUrlChange: (value: string) => void;
  onMqttBrokerChange: (value: string) => void;
  onMqttTopicChange: (value: string) => void;
  onApplySources: () => void;
}

export function SourcesTab({
  httpUrl,
  wsUrl,
  mqttBroker,
  mqttTopic,
  appliedSources,
  sourcesHaveChanges,
  applyingSources,
  onHttpUrlChange,
  onWsUrlChange,
  onMqttBrokerChange,
  onMqttTopicChange,
  onApplySources,
}: SourcesTabProps) {
  return (
    <section className="input-sources-panel">
      <p className="hint">
        HTTP / WebSocket / MQTT から <strong>state / channels / timeline</strong> を JSON
        で注入します。フラットな <code>{`{ "interest": 0.8 }`}</code>{" "}
        形式（state のみ）も引き続き利用できます。変更後は「Apply
        Sources」で反映してください。
      </p>
      <label className="row">
        <span>HTTP URL</span>
        <input
          className="text-input"
          value={httpUrl}
          onChange={(e) => onHttpUrlChange(e.target.value)}
          placeholder="http://localhost:3000/input"
        />
      </label>
      <label className="row">
        <span>WebSocket URL</span>
        <input
          className="text-input"
          value={wsUrl}
          onChange={(e) => onWsUrlChange(e.target.value)}
          placeholder="ws://localhost:8080/input"
        />
      </label>
      <label className="row">
        <span>MQTT Broker</span>
        <input
          className="text-input"
          value={mqttBroker}
          onChange={(e) => onMqttBrokerChange(e.target.value)}
          placeholder="mqtt://localhost:1883"
        />
      </label>
      <label className="row">
        <span>MQTT Topic</span>
        <input
          className="text-input"
          value={mqttTopic}
          onChange={(e) => onMqttTopicChange(e.target.value)}
          placeholder="puppetflow/input"
        />
      </label>
      <button
        type="button"
        className={sourcesHaveChanges ? "primary" : undefined}
        disabled={applyingSources || !sourcesHaveChanges}
        onClick={() => {
          onApplySources();
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
  );
}
