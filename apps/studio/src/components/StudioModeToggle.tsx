import type { StudioMode } from "../constants/studio-mode";

interface StudioModeToggleProps {
  mode: StudioMode;
  onChange: (mode: StudioMode) => void;
}

export function StudioModeToggle({ mode, onChange }: StudioModeToggleProps) {
  return (
    <div className="studio-mode-toggle" role="group" aria-label="編集モード">
      <button
        type="button"
        className={mode === "simple" ? "mode-btn active" : "mode-btn"}
        onClick={() => onChange("simple")}
        aria-pressed={mode === "simple"}
      >
        かんたん
      </button>
      <button
        type="button"
        className={mode === "expert" ? "mode-btn active" : "mode-btn"}
        onClick={() => onChange("expert")}
        aria-pressed={mode === "expert"}
      >
        エキスパート
      </button>
    </div>
  );
}
