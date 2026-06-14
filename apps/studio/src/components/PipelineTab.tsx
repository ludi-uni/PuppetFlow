import type { MotionState } from "@puppetflow/core";
import type { PluginOutputSnapshot, StatefulEntrySnapshot } from "@puppetflow/runtime";
import {
  CHANNEL_SLIDERS,
  EMOTION_CHANNEL_OPTIONS,
  INPUT_SLIDERS,
  PHONEME_OPTIONS,
  TIMELINE_PHONEME_MS,
} from "../constants/pipeline-sliders";
import { KeyValueTable } from "./KeyValueTable";
import { MotionTable } from "./MotionTable";
import { MouthStatusBar } from "./MouthStatusBar";
import { PluginOutputsPanel } from "./PluginOutputsPanel";
import { StatefulDebugPanel } from "./StatefulDebugPanel";

function formatValue(value: number): string {
  return value.toFixed(3);
}

export interface PipelineTabProps {
  isSimpleMode: boolean;
  renderedMotion: MotionState | null;
  targetMotion: MotionState | null;
  phonemeInputSource: string;
  graphMouthMapped: boolean;
  externalInputActive: boolean;
  inputs: Record<string, number>;
  onInputsChange: (next: Record<string, number>) => void;
  channelInputs: Record<string, number>;
  onChannelInputsChange: (next: Record<string, number>) => void;
  phonemeChannel: string;
  onPhonemeChannelChange: (value: string) => void;
  emotionChannel: string;
  onEmotionChannelChange: (value: string) => void;
  emotionPluginEnabled: boolean;
  onResetChannels: () => void;
  onPushTimelinePhoneme: () => void;
  channelTableRows: Array<{ key: string; value: string }>;
  timelineTableRows: Array<{ key: string; value: string }>;
  timelineCurrentMs: number;
  stateSnapshot: Record<string, number>;
  behaviorPluginIds: string[];
  pipelineOutputs: PluginOutputSnapshot[];
  statefulSnapshot: StatefulEntrySnapshot[];
}

export function PipelineTab({
  isSimpleMode,
  renderedMotion,
  targetMotion,
  phonemeInputSource,
  graphMouthMapped,
  externalInputActive,
  inputs,
  onInputsChange,
  channelInputs,
  onChannelInputsChange,
  phonemeChannel,
  onPhonemeChannelChange,
  emotionChannel,
  onEmotionChannelChange,
  emotionPluginEnabled,
  onResetChannels,
  onPushTimelinePhoneme,
  channelTableRows,
  timelineTableRows,
  timelineCurrentMs,
  stateSnapshot,
  behaviorPluginIds,
  pipelineOutputs,
  statefulSnapshot,
}: PipelineTabProps) {
  return (
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
                    onInputsChange({
                      ...inputs,
                      [slider.key]: Number(e.target.value),
                    })
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
                    onChannelInputsChange({
                      ...channelInputs,
                      [slider.key]: Number(e.target.value),
                    })
                  }
                />
                <span className="value">
                  {formatValue(channelInputs[slider.key] ?? slider.defaultValue)}
                </span>
              </label>
            ))}
            <label className="row">
              <span>{isSimpleMode ? "口の形（あいうえお）" : "Channel phoneme"}</span>
              <select
                value={phonemeChannel}
                onChange={(e) => onPhonemeChannelChange(e.target.value)}
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
                  onChange={(e) => onEmotionChannelChange(e.target.value)}
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
              <button type="button" onClick={onResetChannels}>
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
              <button type="button" onClick={onPushTimelinePhoneme}>
                タイムラインに音素を送る（{TIMELINE_PHONEME_MS}ms）
              </button>
            </section>
          ) : (
            <section className="input-section">
              <h2>口の動きを試す</h2>
              <p className="hint">
                選んだ口の形を短く送って、リップシンクの動きを確認できます。
              </p>
              <button type="button" onClick={onPushTimelinePhoneme}>
                口の形を一瞬送る（{TIMELINE_PHONEME_MS}ms）
              </button>
            </section>
          )}
        </div>
        <div className="pipeline-inspectors">
          {!isSimpleMode ? (
            <>
              <h2>Channel 一覧</h2>
              <KeyValueTable rows={channelTableRows} emptyHint="（channel 未設定）" />
              <h2>Timeline 稼働中（{timelineCurrentMs} ms）</h2>
              <KeyValueTable rows={timelineTableRows} emptyHint="（active イベントなし）" />
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
          <div className="pipeline-stages">
            <h2>Stateful 状態</h2>
            <p className="hint">
              PFScript / Graph / Extension Pack が保持するフレーム跨ぎ状態（id /
              現在値 / 内部 state）。
            </p>
            <StatefulDebugPanel entries={statefulSnapshot} />
          </div>
        </>
      ) : null}
    </section>
  );
}
