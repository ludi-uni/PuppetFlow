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

Pushing to `main` triggers the [release workflow](.github/workflows/release.yml), which auto-bumps the patch version, runs CI, builds portable ZIPs, and publishes a GitHub Release.

```text
push to main → plan (v0.1.3 → v0.1.4) → verify → build → publish
```

### Skip a release

Add `[skip release]` to the commit message when merging documentation-only or WIP changes to `main`.

### Manual version override

Use **Actions → Release → Run workflow** on `main` and enter a specific version (e.g. `0.2.0`). Leave the field empty to auto-bump the patch version from the latest tag.

### Pull requests

PRs run the [CI workflow](.github/workflows/ci.yml) only. Releases happen after merge to `main`.

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
