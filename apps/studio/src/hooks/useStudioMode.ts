import { useCallback, useMemo, useState } from "react";
import {
  getTabsForMode,
  loadStudioMode,
  normalizeTabForMode,
  saveStudioMode,
  type StudioMode,
  type TabId,
} from "../constants/studio-mode";

export function useStudioMode(initialTab: TabId = "pipeline") {
  const [studioMode, setStudioMode] = useState<StudioMode>(() => loadStudioMode());
  const [tab, setTab] = useState<TabId>(initialTab);

  const tabs = useMemo(() => getTabsForMode(studioMode), [studioMode]);
  const isSimpleMode = studioMode === "simple";

  const handleStudioModeChange = useCallback((nextMode: StudioMode) => {
    saveStudioMode(nextMode);
    setStudioMode(nextMode);
    setTab((current) => normalizeTabForMode(current, nextMode));
  }, []);

  const goToTab = useCallback(
    (nextTab: TabId) => {
      setTab(normalizeTabForMode(nextTab, studioMode));
    },
    [studioMode],
  );

  return {
    studioMode,
    tab,
    setTab,
    goToTab,
    tabs,
    isSimpleMode,
    handleStudioModeChange,
  };
}
