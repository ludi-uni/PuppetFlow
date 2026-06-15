import { loadPreset } from "@puppetflow/preset";
import { PuppetFlowRuntime } from "@puppetflow/runtime";

import { attachNodeAdapters } from "./attach-node-adapters.js";
import { attachSources } from "./attach-sources.js";
import type { RuntimeLaunchConfig } from "./types.js";

export function buildRuntime(config: RuntimeLaunchConfig): PuppetFlowRuntime {
  const loaded = loadPreset(config.presetJson);
  const runtime = new PuppetFlowRuntime().loadPreset(loaded);

  attachNodeAdapters(runtime, config.adapters);

  if (config.sources) {
    attachSources(runtime, config.sources);
  }

  if (config.initialState) {
    for (const [key, value] of Object.entries(config.initialState)) {
      runtime.state.set(key, value);
    }
  }

  return runtime;
}
