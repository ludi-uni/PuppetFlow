# Contributing to PuppetFlow

Thank you for your interest in PuppetFlow. This document covers the basics for local development and pull requests.

## Prerequisites

- Node.js **22+**
- pnpm **9+** (`corepack enable && corepack prepare pnpm@9.15.9 --activate`)
- Rust + platform deps for **Tauri** apps (Studio / Playground) — [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

Optional environment variables: copy [`.env.example`](.env.example) to `.env`.

## Project structure

| Path                                  | Purpose                                              |
| ------------------------------------- | ---------------------------------------------------- |
| `packages/*`                          | Publishable libraries (`@puppetflow/*`)              |
| `apps/studio`                         | Tauri + React authoring UI                           |
| `apps/cli`                            | `pf` headless CLI                                    |
| `apps/playground`, `editor`, `viewer` | Demos and tools                                      |
| `presets/`                            | Canonical `Standard.pfpreset` and CI-checked outputs |
| `docs/`                               | User documentation (mostly Japanese)                 |

## Before opening a PR

1. **Tests** — `pnpm test`
2. **Lint** — `pnpm lint`
3. **Format** — `pnpm format:check` (or `pnpm format` to fix)
4. **Build** — `pnpm build`
5. **Presets** — if you change preset build logic, run `pnpm build:presets` and commit generated files under `presets/` and `packages/behavior-packs/presets/`

CI runs the same checks on every push and pull request.

## Creating a release

The [release workflow](.github/workflows/release.yml) runs CI checks, builds portable ZIPs, and publishes a GitHub Release in one go.

### Option A — GitHub Actions UI (easiest)

1. Update [CHANGELOG.md](CHANGELOG.md) for the version and merge to `main`.
2. Go to **Actions → Release → Run workflow**.
3. Enter the semver version without `v` (e.g. `0.1.4`) and run.
4. When the workflow finishes, assets appear on [GitHub Releases](https://github.com/ludi-uni/PuppetFlow/releases).

### Option B — git tag

```bash
git tag v0.1.4
git push origin v0.1.4
```

### Option C — GitHub CLI

```bash
gh workflow run release.yml -f version=0.1.4
```

Build artifacts:

- **Studio** — portable ZIP per OS (Tauri app bundle)
- **CLI** — `pf-cli-*.zip` per OS (Node 22+ required at runtime)

Optional macOS code signing (not required for OSS): set repository secrets `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, and notarization credentials — see [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/).

## Code style

- TypeScript ESM across the monorepo
- Match existing naming and package boundaries
- Prefer focused changes; avoid unrelated refactors in the same PR
- Comments only where behavior is non-obvious

## Documentation

- User-facing docs live under `docs/` (Japanese is the primary language today)
- Update `docs/README.md` and relevant guides when behavior changes
- Root `README.md` is English for GitHub discovery

## Questions

Open a GitHub issue if something is unclear.  
日本語での issue / PR も歓迎します。

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
