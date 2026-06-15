# PuppetFlow CLI example

Headless runtime for streaming PCs. Sends motion via VMC OSC and optionally polls HTTP / WebSocket input sources.

## Quick start

Terminal 1 — external viewer on `127.0.0.1:39539` (VMC)

Terminal 2:

```bash
pnpm pf run --preset Curious
```

With input sources:

```bash
pnpm pf run --preset presets/Standard.pfpreset \
  --http-url http://127.0.0.1:3000/input \
  --ws-url ws://127.0.0.1:8080/input
```

## YAML config

```bash
pnpm pf run --config examples/cli/puppetflow.yaml
```

CLI flags override values from the YAML file.

## Stop

Press `Ctrl+C`. The runtime shuts down adapters and sources cleanly.
