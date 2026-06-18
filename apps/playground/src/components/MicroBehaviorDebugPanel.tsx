import type { MicroBehaviorId, MicroBehaviorSnapshot } from "@puppetflow/micro-behavior";

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
  onTrigger: (behavior: MicroBehaviorId) => void;
}

export function MicroBehaviorDebugPanel({
  snapshot,
  onTrigger,
}: MicroBehaviorDebugPanelProps) {
  const { status, queue, cooldowns } = snapshot;

  return (
    <section className="micro-behavior-debug">
      <h2>Behavior Debug</h2>

      <dl className="micro-behavior-status">
        <div>
          <dt>Active</dt>
          <dd>{status.activeBehavior ?? "—"}</dd>
        </div>
        <div>
          <dt>Remaining</dt>
          <dd>{status.activeBehavior ? status.remaining.toFixed(2) : "—"}</dd>
        </div>
        <div>
          <dt>Queue</dt>
          <dd>{queue.queueLength}</dd>
        </div>
      </dl>

      {cooldowns.length > 0 ? (
        <div className="micro-behavior-cooldowns">
          <h3>Cooldown</h3>
          <ul>
            {cooldowns.map((entry) => (
              <li key={entry.behavior}>
                {entry.behavior}: {entry.remainingSeconds.toFixed(1)}s
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="hint">Cooldown: none</p>
      )}

      <div className="micro-behavior-buttons">
        {BEHAVIOR_BUTTONS.map((button) => (
          <button
            key={button.id}
            type="button"
            className="apply-button"
            onClick={() => onTrigger(button.id)}
          >
            {button.label}
          </button>
        ))}
      </div>
    </section>
  );
}
