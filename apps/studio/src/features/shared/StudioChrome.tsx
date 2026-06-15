import { ActiveConfigSummary } from "../../components/ActiveConfigSummary";
import { HelpGuide } from "../../components/HelpGuide";
import { NextStepBar } from "../../components/NextStepBar";
import { StatusBanner, type StatusKind } from "../../components/StatusBanner";
import { StudioModeToggle } from "../../components/StudioModeToggle";
import type { HttpHealth } from "../../hooks/useInputSources";
import type { MotionMapperEditorConfig } from "../../mapper-config";
import type { PresetName, SourceConfig } from "../../runtime";
import type { NextStepGuide } from "../../utils/next-step";
import type { StudioMode, TabId } from "../../constants/studio-mode";

export interface StudioChromeProps {
  studioMode: StudioMode;
  isSimpleMode: boolean;
  tab: TabId;
  tabs: Array<{ id: TabId; label: string; description: string }>;
  status: { kind: StatusKind; message: string } | null;
  nextStepGuide: NextStepGuide;
  preset: PresetName;
  customPreset: boolean;
  appliedSources: SourceConfig;
  behaviorPluginIds: string[];
  activePluginIds: string[];
  appliedMapperConfig: MotionMapperEditorConfig;
  httpHealth: HttpHealth;
  onStudioModeChange: (mode: StudioMode) => void;
  onDismissStatus: () => void;
  onGoToNextStepTab: () => void;
  onSelectTab: (tab: TabId) => void;
  onExportCliConfig?: () => void;
}

export function StudioChrome({
  studioMode,
  isSimpleMode,
  tab,
  tabs,
  status,
  nextStepGuide,
  preset,
  customPreset,
  appliedSources,
  behaviorPluginIds,
  activePluginIds,
  appliedMapperConfig,
  httpHealth,
  onStudioModeChange,
  onDismissStatus,
  onGoToNextStepTab,
  onSelectTab,
  onExportCliConfig,
}: StudioChromeProps) {
  const configSummary = (
    <ActiveConfigSummary
      preset={preset}
      isCustomPreset={customPreset}
      sources={appliedSources}
      behaviorPluginIds={behaviorPluginIds}
      pluginIds={activePluginIds}
      mapperConfig={appliedMapperConfig}
      httpHealth={httpHealth}
      onExportCliConfig={onExportCliConfig}
    />
  );

  return (
    <>
      <header className="studio-header">
        <div>
          <h1>PuppetFlow Studio</h1>
          <p>
            {isSimpleMode
              ? "かんたんモード — キャラの動きを直感的に設定（描画は外部 Viewer）"
              : "パイプライン編集・監視ツール（キャラ描画は外部 Viewer で行います）"}
          </p>
        </div>
        <div className="studio-header-actions">
          <StudioModeToggle mode={studioMode} onChange={onStudioModeChange} />
          <HelpGuide mode={studioMode} />
        </div>
      </header>

      {status ? (
        <StatusBanner
          kind={status.kind}
          message={status.message}
          onDismiss={onDismissStatus}
        />
      ) : null}

      {isSimpleMode ? (
        <NextStepBar guide={nextStepGuide} onGoToTab={onGoToNextStepTab} />
      ) : null}

      {isSimpleMode ? (
        <details className="config-summary-details">
          <summary>設定の詳細を見る</summary>
          {configSummary}
        </details>
      ) : (
        configSummary
      )}

      <nav className="tabs" aria-label="Studio tabs">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "tab active" : "tab"}
            onClick={() => onSelectTab(item.id)}
            title={item.description}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}
