# PuppetFlow

Event-driven character runtime: **State → Plugins → Behavior → Motion Graph → Modifiers → Adapter → Viewer**

📖 **Documentation:** [docs/README.md](docs/README.md)

## Apps

| App        | Command           | Role                                                                                   |
| ---------- | ----------------- | -------------------------------------------------------------------------------------- |
| **Studio** | `pnpm dev:studio` | **Main authoring tool** — Scratch, graph editor, plugins, presets, sources, OSC mapper |
| Playground | `pnpm dev`        | Lightweight Tauri demo (sliders + VMC send)                                            |
| Editor     | `pnpm dev:editor` | Standalone graph editor (subset of Studio)                                             |
| Viewer     | `pnpm dev:viewer` | WebSocket motion debug view (optional; character rendering is typically external)      |

**Recommended workflow:** Use **Studio** to edit the pipeline and send motion via OSC to your external viewer (nijiexpose, Live2D, VRM apps). Playground is for quick runtime checks; Viewer is optional for motion-value inspection without a character app.

## Ecosystem demo

Terminal 1:

```bash
pnpm example:ecosystem
```

Terminal 2:

```bash
pnpm dev:viewer
```

This runs VMC + Live2D + VRM + WebSocket adapters together and streams motion to the Viewer at `ws://127.0.0.1:3939`.

## Packages

### Core pipeline

- `@puppetflow/core`, `@puppetflow/runtime`, `@puppetflow/preset`
- `@puppetflow/behavior`, `@puppetflow/motion-graph`, `@puppetflow/behavior-packs`
- `@puppetflow/plugin-rule`, `@puppetflow/plugin-gaze`, `@puppetflow/plugin-blink`, `@puppetflow/plugin-idle`, `@puppetflow/plugin-attention`, `@puppetflow/plugin-emotion`
- `@puppetflow/modifier`, `@puppetflow/motion-mapper`

### Adapters

- `@puppetflow/adapter-vmc` — VMC OSC (Tauri + Node)
- `@puppetflow/adapter-live2d` — Live2D parameter mapping via OSC
- `@puppetflow/adapter-vrm` — VRM blend shape mapping via OSC
- `@puppetflow/adapter-websocket` — Motion broadcast for Viewer
- `@puppetflow/adapter-logger` — Debug logging

### State sources

- `@puppetflow/source-http` — HTTP polling
- `@puppetflow/source-websocket` — WebSocket JSON input
- `@puppetflow/source-mqtt` — MQTT subscription
- `@puppetflow/source-discord` — Discord channel JSON messages (Node)

## Quick start

```bash
pnpm install
pnpm build
pnpm test
```

## License

Apache-2.0
