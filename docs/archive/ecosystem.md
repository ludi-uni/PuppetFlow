# PuppetFlow Ecosystem

## Adapter outputs

| Adapter   | Output                             | Default target        |
| --------- | ---------------------------------- | --------------------- |
| VMC       | OSC `/VMC/Ext/Blend/Val`           | `127.0.0.1:39539`     |
| Live2D    | OSC (Live2D param names)           | `127.0.0.1:39539`     |
| VRM       | OSC (VRM blend names)              | `127.0.0.1:39539`     |
| WebSocket | JSON `{ type, motion, deltaTime }` | `ws://127.0.0.1:3939` |
| Logger    | Console                            | local                 |

Parameter names are mapping-driven. Edit `mappings/default.json` in each adapter package.

## State sources

| Source    | Input format                                                     |
| --------- | ---------------------------------------------------------------- |
| HTTP      | `GET` returns `{ "interest": 0.8 }`                              |
| WebSocket | `{ "interest": 0.8 }` or `{ "type": "state", "state": { ... } }` |
| MQTT      | topic payload JSON object                                        |
| Discord   | channel message with JSON body                                   |

## Viewer

`apps/viewer` connects to `@puppetflow/adapter-websocket` and renders a simple motion preview.

## Discord setup (Node only)

```ts
import { DiscordSource } from "@puppetflow/source-discord";

runtime.attachSource(
  new DiscordSource({
    token: process.env.DISCORD_BOT_TOKEN!,
    channelId: "1234567890",
  }),
);
```

Post JSON like `{ "interest": 0.9, "joy": 0.7 }` in the configured channel.
