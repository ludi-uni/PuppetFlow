import { useState } from "react";

export function HelpGuide() {
  const [open, setOpen] = useState(false);

  return (
    <aside className="help-guide">
      <button
        type="button"
        className="help-toggle"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        {open ? "ガイドを閉じる" : "使い方ガイド"}
      </button>
      {open ? (
        <div className="help-body">
          <p>
            PuppetFlow Studio はキャラクターの<strong>制御パイプライン</strong>
            を編集・監視するツールです。キャラの描画は外部 Viewer（nijiexpose
            等）で行います。
          </p>
          <ol>
            <li>
              <strong>Pipeline</strong> — State（長寿命）と Channel（volume / phoneme
              等）を入力。 口を動かすには Graph で mouthX / mouthY
              へのマッピングが必要です
            </li>
            <li>
              <strong>Graph Editor</strong> — 「リップシンク簡易テンプレ」で volume →
              mouthY 等を配置し Preset にエクスポート
            </li>
            <li>
              <strong>Plugins</strong> — Emotion 等。Emotion は Channel の{" "}
              <code>emotion</code> を参照します
            </li>
            <li>
              <strong>Input Sources</strong> — HTTP / WS / MQTT から state / channels /
              timeline を JSON で注入
            </li>
            <li>
              <strong>Motion Mapper</strong> — Rendered Motion の OSC 送出先を設定
            </li>
          </ol>
          <p className="hint">
            Channel は sticky（値を保持）。無音時は <code>volume: 0</code> や{" "}
            <code>phoneme: &quot;Rest&quot;</code> を送ってください。
          </p>
        </div>
      ) : null}
    </aside>
  );
}
