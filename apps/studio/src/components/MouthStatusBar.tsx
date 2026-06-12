import type { MotionState } from "@puppetflow/core";
import { phonemeSourceLabel, type PhonemeInputSource } from "../utils/phoneme-source";

interface MouthStatusBarProps {
  rendered: MotionState | null;
  phonemeSource: PhonemeInputSource;
  graphMapped: boolean;
}

function formatMouth(value: number | undefined): string {
  return value === undefined ? "—" : value.toFixed(3);
}

export function MouthStatusBar({
  rendered,
  phonemeSource,
  graphMapped,
}: MouthStatusBarProps) {
  return (
    <div className="mouth-status-bar" role="status" aria-live="polite">
      <div className="mouth-status-metrics">
        <span>
          mouthX: <strong>{formatMouth(rendered?.mouthX)}</strong>
        </span>
        <span>
          mouthY: <strong>{formatMouth(rendered?.mouthY)}</strong>
        </span>
        <span className="mouth-status-phoneme">
          口形入力: <strong>{phonemeSourceLabel(phonemeSource)}</strong>
        </span>
      </div>
      {!graphMapped ? (
        <p className="mouth-status-warning">
          Graph に Channel / リップシンク用ノードが未設定です。Pipeline の Volume
          を動かしても口は動きません。 Graph Editor
          で「リップシンク簡易テンプレ」を挿入し、エクスポート → 適用してください。
        </p>
      ) : null}
    </div>
  );
}
