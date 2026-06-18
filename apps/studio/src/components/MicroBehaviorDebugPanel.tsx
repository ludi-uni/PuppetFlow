import type { BehaviorId, MicroBehaviorId, MicroBehaviorSnapshot } from "@puppetflow/micro-behavior";

const BEHAVIOR_BUTTONS: Array<{ id: MicroBehaviorId; label: string }> = [
  { id: "look_up", label: "Look Up" },
  { id: "look_left", label: "Look Left" },
  { id: "look_right", label: "Look Right" },
  { id: "head_tilt", label: "Head Tilt" },
  { id: "small_nod", label: "Small Nod" },
  { id: "long_blink", label: "Long Blink" },
];

interface MicroBehaviorDebugPanelProps {
  snapshot: MicroBehaviorSnapshot;
  onTrigger: (behavior: BehaviorId) => void;
  customBehaviorIds?: BehaviorId[];
  isSimpleMode?: boolean;
}

export function MicroBehaviorDebugPanel({
  snapshot,
  onTrigger,
  customBehaviorIds = [],
  isSimpleMode = false,
}: MicroBehaviorDebugPanelProps) {
  const { status, queue, cooldowns } = snapshot;

  return (
    <div className="micro-behavior-debug">
      <dl className="summary-grid micro-behavior-status">
        <div>
          <dt>{isSimpleMode ? "いまの動き" : "Active Behavior"}</dt>
          <dd>{status.activeBehavior ?? "—"}</dd>
        </div>
        <div>
          <dt>{isSimpleMode ? "残り時間" : "Remaining (s)"}</dt>
          <dd>{status.activeBehavior ? status.remaining.toFixed(2) : "—"}</dd>
        </div>
        <div>
          <dt>{isSimpleMode ? "待ち行列" : "Queue"}</dt>
          <dd>{queue.queueLength}</dd>
        </div>
      </dl>

      {cooldowns.length > 0 ? (
        <div className="micro-behavior-cooldowns">
          <p className="hint">Cooldown</p>
          <ul>
            {cooldowns.map((entry) => (
              <li key={entry.behavior}>
                <code>{entry.behavior}</code>: {entry.remainingSeconds.toFixed(1)}s
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="hint">Cooldown: なし</p>
      )}

      <div className="micro-behavior-buttons">
        {BEHAVIOR_BUTTONS.map((button) => (
          <button key={button.id} type="button" onClick={() => onTrigger(button.id)}>
            {button.label}
          </button>
        ))}
      </div>

      {customBehaviorIds.length > 0 ? (
        <div className="micro-behavior-custom-buttons">
          <p className="hint">{isSimpleMode ? "カスタム" : "Custom"}</p>
          <div className="micro-behavior-buttons">
            {customBehaviorIds.map((id) => (
              <button key={id} type="button" onClick={() => onTrigger(id)}>
                {id}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
