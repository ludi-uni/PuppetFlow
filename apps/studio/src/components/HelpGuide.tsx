import { useState } from "react";
import type { StudioMode } from "../constants/studio-mode";

interface HelpGuideProps {
  mode: StudioMode;
}

export function HelpGuide({ mode }: HelpGuideProps) {
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
          {mode === "simple" ? (
            <>
              <p>
                <strong>かんたんモード</strong>
                では、専門用語を減らしてキャラの動きを設定できます。 キャラの表示は外部
                Viewer（VSeeFace / nijiexpose 等）で行います。
              </p>
              <ol>
                <li>
                  <strong>キャラの雰囲気</strong> — プリセットを選んで基本の動きを決める
                </li>
                <li>
                  <strong>動きのつなぎ</strong> — 興味・元気などと表情・姿勢を結びつける
                </li>
                <li>
                  <strong>オプション動き</strong> — まばたき・視線などを ON/OFF
                </li>
                <li>
                  <strong>動作確認</strong> — スライダーで試す
                </li>
                <li>
                  <strong>キャラへの送信</strong> — 使っている Viewer アプリを選ぶ
                </li>
              </ol>
              <p className="hint">
                より細かい設定が必要なときは、画面上部の「エキスパート」に切り替えてください。
              </p>
            </>
          ) : (
            <>
              <p>
                PuppetFlow Studio はキャラクターの<strong>制御パイプライン</strong>
                を編集・監視するツールです。キャラの描画は外部 Viewer（nijiexpose
                等）で行います。
              </p>
              <ol>
                <li>
                  <strong>Pipeline</strong> — State（長寿命）と Channel（volume /
                  phoneme 等）を入力。 口を動かすには Graph で mouthX / mouthY
                  へのマッピングが必要です
                </li>
                <li>
                  <strong>Graph Editor</strong> — 「リップシンク簡易テンプレ」で volume
                  → mouthY 等を配置し Preset にエクスポート
                </li>
                <li>
                  <strong>Plugins</strong> — Emotion 等。Emotion は Channel の{" "}
                  <code>emotion</code> を参照します
                </li>
                <li>
                  <strong>Input Sources</strong> — HTTP / WS / MQTT から state /
                  channels / timeline を JSON で注入
                </li>
                <li>
                  <strong>Motion Mapper</strong> — Rendered Motion の OSC 送出先を設定
                </li>
              </ol>
              <p className="hint">
                Channel は sticky（値を保持）。無音時は <code>volume: 0</code> や{" "}
                <code>phoneme: &quot;Rest&quot;</code> を送ってください。
              </p>
            </>
          )}
        </div>
      ) : null}
    </aside>
  );
}
