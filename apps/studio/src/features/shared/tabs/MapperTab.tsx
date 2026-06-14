import { MotionMapperEditor } from "../../../components/MotionMapperEditor";
import { SimpleOscMapperEditor } from "../../../components/SimpleOscMapperEditor";
import type { MotionMapperEditorConfig } from "../../../mapper-config";
import type { StudioMode } from "../../../constants/studio-mode";

export interface MapperTabProps {
  isSimpleMode: boolean;
  mapperEditorKey: number;
  appliedMapperConfig: MotionMapperEditorConfig;
  activePluginIds: string[];
  extensionCustomParamIds: string[];
  onApplySimpleMapper: (config: MotionMapperEditorConfig) => Promise<void>;
  onApplyExpertMapper: (config: MotionMapperEditorConfig) => Promise<void>;
  onStudioModeChange: (mode: StudioMode) => void;
  onStayOnMapperTab: () => void;
}

export function MapperTab({
  isSimpleMode,
  mapperEditorKey,
  appliedMapperConfig,
  activePluginIds,
  extensionCustomParamIds,
  onApplySimpleMapper,
  onApplyExpertMapper,
  onStudioModeChange,
  onStayOnMapperTab,
}: MapperTabProps) {
  if (isSimpleMode) {
    return (
      <SimpleOscMapperEditor
        key={mapperEditorKey}
        initialConfig={appliedMapperConfig}
        extensionCustomParamIds={extensionCustomParamIds}
        onApply={onApplySimpleMapper}
        onOpenExpert={() => {
          onStudioModeChange("expert");
          onStayOnMapperTab();
        }}
      />
    );
  }

  return (
    <MotionMapperEditor
      key={mapperEditorKey}
      initialConfig={appliedMapperConfig}
      activePluginIds={activePluginIds}
      extensionCustomParamIds={extensionCustomParamIds}
      onApply={onApplyExpertMapper}
    />
  );
}
