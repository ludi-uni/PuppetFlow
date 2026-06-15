import { useCallback, useMemo, useState } from "react";
import {
  getTabsForMode,
  loadStudioMode,
  loadStudioTab,
  normalizeTabForMode,
  saveStudioMode,
  saveStudioTab,
  type StudioMode,
  type TabId,
} from "../constants/studio-mode";

export function useStudioMode(initialTab: TabId = "pipeline") {
  const [studioMode, setStudioMode] = useState<StudioMode>(() => loadStudioMode());
  const [tab, setTab] = useState<TabId>(() => {
    const mode = loadStudioMode();
    const stored = loadStudioTab(mode);
    return normalizeTabForMode(stored ?? initialTab, mode);
  });

  const tabs = useMemo(() => getTabsForMode(studioMode), [studioMode]);
  const isSimpleMode = studioMode === "simple";

  const handleStudioModeChange = useCallback((nextMode: StudioMode) => {
    saveStudioMode(nextMode);
    setStudioMode(nextMode);
    setTab((current) => {
      const nextTab = normalizeTabForMode(current, nextMode);
      saveStudioTab(nextMode, nextTab);
      return nextTab;
    });
  }, []);

  const goToTab = useCallback(
    (nextTab: TabId) => {
      const normalized = normalizeTabForMode(nextTab, studioMode);
      saveStudioTab(studioMode, normalized);
      setTab(normalized);
    },
    [studioMode],
  );

  const selectTab = useCallback(
    (nextTab: TabId) => {
      const normalized = normalizeTabForMode(nextTab, studioMode);
      saveStudioTab(studioMode, normalized);
      setTab(normalized);
    },
    [studioMode],
  );

  return {
    studioMode,
    tab,
    setTab: selectTab,
    goToTab,
    tabs,
    isSimpleMode,
    handleStudioModeChange,
  };
}
