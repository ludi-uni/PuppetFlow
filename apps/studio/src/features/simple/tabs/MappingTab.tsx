import { SimpleGraphMappingEditor } from "../../../components/SimpleGraphMappingEditor";

export interface MappingTabProps {
  presetJson: string;
  graphJson: string;
  applyingPreset: boolean;
  onGraphChange: (nextGraphJson: string, nextPresetJson: string) => void;
  onApply: () => void;
}

export function MappingTab({
  presetJson,
  graphJson,
  applyingPreset,
  onGraphChange,
  onApply,
}: MappingTabProps) {
  return (
    <SimpleGraphMappingEditor
      presetJson={presetJson}
      graphJson={graphJson}
      applying={applyingPreset}
      onGraphChange={onGraphChange}
      onApply={onApply}
    />
  );
}
