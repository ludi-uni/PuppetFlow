import { stringify } from "yaml";

import type { CliYamlConfig } from "./studio-export.js";

export interface SerializeCliYamlOptions {
  includeCustomPresetNote?: boolean;
}

export function serializeCliYamlConfig(
  config: CliYamlConfig,
  options: SerializeCliYamlOptions = {},
): string {
  const body = stringify(config, { lineWidth: 0 }).trimEnd();
  const lines = [
    "# Exported from PuppetFlow Studio",
    "# Run: pnpm pf run --config puppetflow.yaml",
  ];
  if (options.includeCustomPresetNote) {
    lines.push("# Custom preset: keep the downloaded .pfpreset next to this file.");
  }

  return `${lines.join("\n")}\n\n${body}\n`;
}
