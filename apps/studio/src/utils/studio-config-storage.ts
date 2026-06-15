import type { StudioMode, TabId } from "../constants/studio-mode";
import {
  cloneMapperConfig,
  DEFAULT_MAPPER_CONFIG,
  type MotionMapperEditorConfig,
} from "../mapper-config";
import type { SourceConfig } from "../runtime";

const STORAGE_KEY = "puppetflow.studio.config.v1";
const LEGACY_MODE_KEY = "puppetflow.studio.mode";

export interface SourceDraftFields {
  httpUrl: string;
  wsUrl: string;
  mqttBroker: string;
  mqttTopic: string;
}

export interface StudioPersistedConfig {
  version: 1;
  studioMode?: StudioMode;
  tabs?: Partial<Record<StudioMode, TabId>>;
  mapper?: MotionMapperEditorConfig;
  sources?: SourceConfig;
  sourceDraft?: SourceDraftFields;
}

function readStorage(): StudioPersistedConfig {
  if (typeof localStorage === "undefined") {
    return { version: 1 };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return migrateLegacyModeOnly();
    }

    const parsed = JSON.parse(raw) as Partial<StudioPersistedConfig>;
    if (parsed.version !== 1) {
      return { version: 1 };
    }

    return {
      version: 1,
      studioMode: parsed.studioMode,
      tabs: parsed.tabs,
      mapper: parseMapperConfig(parsed.mapper),
      sources: parseSourceConfig(parsed.sources),
      sourceDraft: parseSourceDraft(parsed.sourceDraft),
    };
  } catch {
    return { version: 1 };
  }
}

function migrateLegacyModeOnly(): StudioPersistedConfig {
  const config: StudioPersistedConfig = { version: 1 };
  if (typeof localStorage === "undefined") {
    return config;
  }

  const legacy = localStorage.getItem(LEGACY_MODE_KEY);
  if (legacy === "expert" || legacy === "simple") {
    config.studioMode = legacy;
  }

  return config;
}

function writeStorage(next: StudioPersistedConfig): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

let cached = readStorage();

function refreshCache(): StudioPersistedConfig {
  cached = readStorage();
  return cached;
}

export function loadStudioPersistedConfig(): StudioPersistedConfig {
  return { ...cached, tabs: cached.tabs ? { ...cached.tabs } : undefined };
}

export function patchStudioPersistedConfig(
  patch: Omit<Partial<StudioPersistedConfig>, "version">,
): void {
  cached = {
    version: 1,
    studioMode: patch.studioMode ?? cached.studioMode,
    tabs: patch.tabs ? { ...cached.tabs, ...patch.tabs } : cached.tabs,
    mapper: patch.mapper ?? cached.mapper,
    sources: patch.sources ?? cached.sources,
    sourceDraft: patch.sourceDraft ?? cached.sourceDraft,
  };
  writeStorage(cached);
}

export function loadPersistedStudioMode(): StudioMode {
  return cached.studioMode ?? "simple";
}

export function savePersistedStudioMode(mode: StudioMode): void {
  patchStudioPersistedConfig({ studioMode: mode });
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LEGACY_MODE_KEY, mode);
  }
}

export function loadPersistedTab(mode: StudioMode): TabId | undefined {
  return cached.tabs?.[mode];
}

export function savePersistedTab(mode: StudioMode, tab: TabId): void {
  patchStudioPersistedConfig({ tabs: { [mode]: tab } });
}

export function loadPersistedMapperConfig(): MotionMapperEditorConfig | null {
  return cached.mapper ? cloneMapperConfig(cached.mapper) : null;
}

export function savePersistedMapperConfig(mapper: MotionMapperEditorConfig): void {
  patchStudioPersistedConfig({ mapper: cloneMapperConfig(mapper) });
}

export function loadPersistedSourceConfig(): SourceConfig | null {
  return cached.sources ? { ...cached.sources } : null;
}

export function savePersistedSourceConfig(sources: SourceConfig): void {
  patchStudioPersistedConfig({ sources: { ...sources } });
}

export function loadPersistedSourceDraft(): SourceDraftFields | null {
  return cached.sourceDraft ? { ...cached.sourceDraft } : null;
}

export function savePersistedSourceDraft(draft: SourceDraftFields): void {
  patchStudioPersistedConfig({ sourceDraft: { ...draft } });
}

/** Test helper */
export function resetStudioPersistedConfigForTests(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_MODE_KEY);
  }
  cached = { version: 1 };
}

export function reloadStudioPersistedConfigFromStorage(): StudioPersistedConfig {
  return refreshCache();
}

function parseSourceConfig(raw: unknown): SourceConfig | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const value = raw as Partial<SourceConfig>;
  return {
    httpUrl: normalizeNullableString(value.httpUrl),
    wsUrl: normalizeNullableString(value.wsUrl),
    mqttBroker: normalizeNullableString(value.mqttBroker),
    mqttTopic: normalizeNullableString(value.mqttTopic),
  };
}

function parseSourceDraft(raw: unknown): SourceDraftFields | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const value = raw as Partial<SourceDraftFields>;
  return {
    httpUrl: typeof value.httpUrl === "string" ? value.httpUrl : "",
    wsUrl: typeof value.wsUrl === "string" ? value.wsUrl : "",
    mqttBroker: typeof value.mqttBroker === "string" ? value.mqttBroker : "",
    mqttTopic: typeof value.mqttTopic === "string" ? value.mqttTopic : "",
  };
}

function parseMapperConfig(raw: unknown): MotionMapperEditorConfig | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const value = raw as Partial<MotionMapperEditorConfig>;
  if (!value.vmc || !value.live2d || !value.vrm) {
    return undefined;
  }

  try {
    return cloneMapperConfig({
      ...DEFAULT_MAPPER_CONFIG,
      ...value,
      vmc: { ...DEFAULT_MAPPER_CONFIG.vmc, ...value.vmc },
      live2d: { ...DEFAULT_MAPPER_CONFIG.live2d, ...value.live2d },
      vrm: { ...DEFAULT_MAPPER_CONFIG.vrm, ...value.vrm },
    });
  } catch {
    return undefined;
  }
}

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return typeof value === "string" ? value : null;
}
