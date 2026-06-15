import { useCallback, useMemo, useState } from "react";
import { getMapperConfig, setMapperConfig } from "../runtime";
import { collectMapperCustomParamIds } from "../utils/mapper-custom-params";
import { savePersistedMapperConfig } from "../utils/studio-config-storage";
import type { MotionMapperEditorConfig } from "../mapper-config";
import type { StatusKind } from "../components/StatusBanner";

export interface UseMapperConfigOptions {
  notify: (message: string, kind?: StatusKind) => void;
  assembledPresetJson: string;
  extensionsJson: string;
}

export function useMapperConfig({
  notify,
  assembledPresetJson,
  extensionsJson,
}: UseMapperConfigOptions) {
  const [mapperEditorKey, setMapperEditorKey] = useState(0);
  const [appliedMapperConfig, setAppliedMapperConfig] =
    useState<MotionMapperEditorConfig>(getMapperConfig());

  const extensionCustomParamIds = useMemo(
    () => collectMapperCustomParamIds(assembledPresetJson, extensionsJson),
    [assembledPresetJson, extensionsJson],
  );

  const syncFromRuntime = useCallback(() => {
    setAppliedMapperConfig(getMapperConfig());
  }, []);

  const handleApplyMapper = useCallback(
    async (config: MotionMapperEditorConfig, successMessage: string) => {
      await setMapperConfig(config);
      setAppliedMapperConfig(getMapperConfig());
      savePersistedMapperConfig(getMapperConfig());
      setMapperEditorKey((current) => current + 1);
      notify(successMessage, "success");
    },
    [notify],
  );

  const handleApplySimpleMapper = useCallback(
    async (config: MotionMapperEditorConfig) => {
      await handleApplyMapper(config, "送信設定を反映しました。");
    },
    [handleApplyMapper],
  );

  const handleApplyExpertMapper = useCallback(
    async (config: MotionMapperEditorConfig) => {
      await handleApplyMapper(config, "Motion Mapper 設定を適用しました。");
    },
    [handleApplyMapper],
  );

  return {
    mapperEditorKey,
    appliedMapperConfig,
    extensionCustomParamIds,
    syncFromRuntime,
    handleApplySimpleMapper,
    handleApplyExpertMapper,
  };
}
