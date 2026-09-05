import { useCallback, useMemo, useState } from "react";
import {
  getTabsForMode,
  getDefaultTab,
  loadBlocklyEnabled,
  loadStudioMode,
  loadStudioTab,
  normalizeTabForMode,
  saveStudioMode,
  saveStudioTab,
  saveBlocklyEnabled,
  type StudioMode,
  type TabId,
} from "../constants/studio-mode";

export function useStudioMode() {
  const [studioMode, setStudioMode] = useState<StudioMode>(() => loadStudioMode());
  const [blocklyEnabled, setBlocklyEnabledState] = useState(() => loadBlocklyEnabled());
  const [tab, setTab] = useState<TabId>(() => {
    const mode = loadStudioMode();
    const stored = loadStudioTab(mode);
    const enabled = loadBlocklyEnabled();
    const normalized = normalizeTabForMode(
      stored ?? getDefaultTab(mode),
      mode,
      enabled,
    );
    if (stored && stored !== normalized) {
      saveStudioTab(mode, normalized);
    }
    return normalized;
  });

  const tabs = useMemo(
    () => getTabsForMode(studioMode, blocklyEnabled),
    [blocklyEnabled, studioMode],
  );
  const isSimpleMode = studioMode === "simple";

  const handleStudioModeChange = useCallback(
    (nextMode: StudioMode) => {
      saveStudioMode(nextMode);
      setStudioMode(nextMode);
      setTab((current) => {
        const nextTab = normalizeTabForMode(current, nextMode, blocklyEnabled);
        saveStudioTab(nextMode, nextTab);
        return nextTab;
      });
    },
    [blocklyEnabled],
  );

  const goToTab = useCallback(
    (nextTab: TabId) => {
      const normalized = normalizeTabForMode(nextTab, studioMode, blocklyEnabled);
      saveStudioTab(studioMode, normalized);
      setTab(normalized);
    },
    [blocklyEnabled, studioMode],
  );

  const selectTab = useCallback(
    (nextTab: TabId) => {
      const normalized = normalizeTabForMode(nextTab, studioMode, blocklyEnabled);
      saveStudioTab(studioMode, normalized);
      setTab(normalized);
    },
    [blocklyEnabled, studioMode],
  );

  const setBlocklyEnabled = useCallback(
    (enabled: boolean) => {
      saveBlocklyEnabled(enabled);
      setBlocklyEnabledState(enabled);
      if (!enabled) {
        setTab((current) => {
          const nextTab = normalizeTabForMode(current, studioMode, false);
          saveStudioTab(studioMode, nextTab);
          return nextTab;
        });
      }
    },
    [studioMode],
  );

  return {
    studioMode,
    tab,
    setTab: selectTab,
    goToTab,
    tabs,
    blocklyEnabled,
    isSimpleMode,
    handleStudioModeChange,
    setBlocklyEnabled,
  };
}
