import type { MotionState } from "@puppetflow/core";
import { phonemeSourceLabel, type PhonemeInputSource } from "../utils/phoneme-source";

interface MouthStatusBarProps {
  rendered: MotionState | null;
  phonemeSource: PhonemeInputSource;
  graphMapped: boolean;
  simpleMode?: boolean;
}

function formatMouth(value: number | undefined): string {
  return value === undefined ? "—" : value.toFixed(3);
}

function formatMouthSimple(value: number | undefined): string {
  if (value === undefined) {
    return "—";
  }

  if (value < 0.05) {
    return "ほぼ閉じている";
  }
  if (value < 0.35) {
    return "少し開いている";
  }
  if (value < 0.7) {
    return "開いている";
  }
  return "大きく開いている";
}

export function MouthStatusBar({
  rendered,
  phonemeSource,
  graphMapped,
  simpleMode = false,
}: MouthStatusBarProps) {
  return (
    <div className="mouth-status-bar" role="status" aria-live="polite">
      <div className="mouth-status-metrics">
        {simpleMode ? (
          <>
            <span>
              口（横）: <strong>{formatMouthSimple(rendered?.mouthX)}</strong>
            </span>
            <span>
              口（開き）: <strong>{formatMouthSimple(rendered?.mouthY)}</strong>
            </span>
            <span className="mouth-status-phoneme">
              口の形: <strong>{phonemeSourceLabel(phonemeSource, true)}</strong>
            </span>
          </>
        ) : (
          <>
            <span>
              mouthX: <strong>{formatMouth(rendered?.mouthX)}</strong>
            </span>
            <span>
              mouthY: <strong>{formatMouth(rendered?.mouthY)}</strong>
            </span>
            <span className="mouth-status-phoneme">
              口形入力: <strong>{phonemeSourceLabel(phonemeSource)}</strong>
            </span>
          </>
        )}
      </div>
      {!graphMapped ? (
        <p className="mouth-status-warning">
          {simpleMode ? (
            <>
              口を動かす設定がまだありません。「動きのつなぎ」でリップシンクを有効にするか、つなぎの行を追加してください。
            </>
          ) : (
            <>
              Graph に Channel / リップシンク用ノードが未設定です。Pipeline の Volume
              を動かしても口は動きません。 Graph Editor
              で「リップシンク簡易テンプレ」を挿入し、エクスポート → 適用してください。
            </>
          )}
        </p>
      ) : simpleMode ? (
        <p className="mouth-status-hint hint">
          声の大きさや口の形を変えると、口（開き）の表示が変わります。
        </p>
      ) : null}
    </div>
  );
}
