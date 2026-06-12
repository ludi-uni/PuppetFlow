export type StatusKind = "success" | "error" | "info";

interface StatusBannerProps {
  kind: StatusKind;
  message: string;
  onDismiss?: () => void;
}

export function StatusBanner({ kind, message, onDismiss }: StatusBannerProps) {
  return (
    <div className={`status-banner status-${kind}`} role="status">
      <span>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          className="status-dismiss"
          onClick={onDismiss}
          aria-label="閉じる"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
