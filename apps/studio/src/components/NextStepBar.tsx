import type { NextStepGuide } from "../utils/next-step";

interface NextStepBarProps {
  guide: NextStepGuide;
  onGoToTab: () => void;
}

export function NextStepBar({ guide, onGoToTab }: NextStepBarProps) {
  const isReady = guide.status === "ready";

  return (
    <section
      className={isReady ? "next-step-bar next-step-bar-ready" : "next-step-bar"}
      aria-label="次にやること"
    >
      <div className="next-step-content">
        <p className="next-step-label">次にやること</p>
        <p className="next-step-message">{guide.message}</p>
        <p className="next-step-detail">{guide.detail}</p>
      </div>
      {!isReady ? (
        <button type="button" className="primary next-step-action" onClick={onGoToTab}>
          {guide.tabLabel}へ
        </button>
      ) : (
        <button type="button" className="next-step-action" onClick={onGoToTab}>
          {guide.tabLabel}で試す
        </button>
      )}
    </section>
  );
}
