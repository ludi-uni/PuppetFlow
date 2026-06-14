import { useCallback, useState } from "react";
import type { StatusKind } from "../components/StatusBanner";

export function useStudioStatus() {
  const [status, setStatus] = useState<{ kind: StatusKind; message: string } | null>(
    null,
  );
  const [behaviorPreviewJson, setBehaviorPreviewJson] = useState("");

  const notify = useCallback((message: string, kind: StatusKind = "info") => {
    setStatus({ kind, message });
  }, []);

  const dismissStatus = useCallback(() => {
    setStatus(null);
  }, []);

  return {
    status,
    notify,
    dismissStatus,
    behaviorPreviewJson,
    setBehaviorPreviewJson,
  };
}
