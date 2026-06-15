# PuppetFlow

<p align="center">
  <img src="logo.png" alt="PuppetFlow" width="128" height="128" />
</p>

[![CI](https://github.com/ludi-uni/PuppetFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/ludi-uni/PuppetFlow/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Event-driven character runtime for VTuber-style avatars:

**State → Plugins → Behavior / PFScript → Motion Graph → Modifiers → Extensions → Adapters → Viewer**

PuppetFlow computes motion; your **external viewer** (VMC, Live2D, VRM apps) renders the character.

📖 **Documentation:** [docs/README.md](docs/README.md) (primarily Japanese)

## Features

- **Preset pipeline** — `.pfpreset` v3 with PFScript, Blockly Scratch, and Motion Graph
- **Official plugins** — blink, idle; extension packs (thinking, tail, ears, …)
- **State sources** — HTTP, WebSocket, MQTT (Discord on Node.js)
- **Motion output** — VMC OSC, Live2D/VRM mapping, WebSocket debug stream
- **Studio** — desktop authoring UI (Tauri)
- **CLI** — headless `pf run` for streaming PCs and servers

## Requirements

- **Node.js** 22+
- **pnpm** 9+ (`corepack enable` recommended)
- **Rust toolchain** — only for Tauri apps (Studio / Playground)
- **External viewer** — e.g. VSeeFace, nijiexpose, or any VMC receiver on `127.0.0.1:39539`

## Quick start

```bash
git clone https://github.com/ludi-uni/PuppetFlow.git
cd PuppetFlow
pnpm install
pnpm build
pnpm test
```

### Studio (recommended)

```bash
pnpm dev:studio
```

Open the **Tauri window** (`puppetflow-studio.exe`). OSC output requires the desktop shell, not the browser URL alone.

### CLI (headless)

```bash
pnpm pf run --preset Curious
# or with config exported from Studio:
pnpm pf run --config puppetflow.yaml
```

See [CLI guide](docs/guides/cli.md).

### Playground (minimal demo)

```bash
pnpm dev
```

## Apps

| App        | Command           | Role                                                                         |
| ---------- | ----------------- | ---------------------------------------------------------------------------- |
| **Studio** | `pnpm dev:studio` | Main authoring tool — Scratch, PFScript, graph, presets, sources, OSC mapper |
| **CLI**    | `pnpm pf run …`   | Headless runtime + VMC/sources from YAML                                     |
| Playground | `pnpm dev`        | Lightweight Tauri demo (sliders + VMC)                                       |
| Editor     | `pnpm dev:editor` | Standalone graph editor                                                      |
| Viewer     | `pnpm dev:viewer` | WebSocket motion debug view                                                  |

## Monorepo layout

```text
apps/          studio, cli, playground, editor, viewer
packages/      core, runtime, preset, pfscript-core, behavior, plugins, adapters, sources, …
presets/       Standard.pfpreset and generated official presets
examples/      pfscript samples, ecosystem demo, CLI config
docs/          guides and reference (Japanese)
```

## Development

```bash
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm build:presets   # regenerate official .pfpreset files
```

Copy `.env.example` to `.env` when using optional integrations (e.g. Discord source).

## Releases

Pre-built portable ZIPs are published automatically when changes are pushed to `main`.

| Asset                              | Platform            | Notes                                                   |
| ---------------------------------- | ------------------- | ------------------------------------------------------- |
| `puppetflow-studio-*-portable.zip` | Windows x64         | Extract and run `puppetflow-studio.exe`                 |
| `puppetflow-studio-*-portable.zip` | Linux x64           | Extract and run `./puppetflow-studio`                   |
| `puppetflow-studio-*-portable.zip` | macOS               | Extract `PuppetFlow Studio.app` (Universal)             |
| `pf-cli-*-portable.zip`            | Win / Linux / macOS | Headless CLI — single `pf` / `pf.exe` (no Node install) |

### Automatic release (default)

Push to `main` and the [Release workflow](.github/workflows/release.yml) will:

1. Bump the patch version from the latest `v*` tag (e.g. `v0.1.3` → `v0.1.4`)
2. Run CI checks (lint, test, build)
3. Build Studio + CLI portable ZIPs
4. Create the git tag and publish a GitHub Release

Skip a release for a commit by including `[skip release]` in the commit message.

### Manual override

- **Actions → Release → Run workflow** — optional version override (leave empty to auto-bump patch)
- Pull requests run the lighter [CI workflow](.github/workflows/ci.yml) only (no release)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and PRs are welcome.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

Apache-2.0 — see [LICENSE](LICENSE).
