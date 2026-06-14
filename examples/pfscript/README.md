# PFScript サンプル

PuppetFlow PFScript（Behavior DSL）の公式サンプルです。

## ファイル

| ファイル | 説明 |
| -------- | ---- |
| `basic-smile.pfscript` | State / Channel から mouth へマッピングする最小例 |
| `lipsync-thinking.pfscript` | リップシンク + 体のゆらぎ（単体 `.pfscript` では `smile` も含む） |
| `stateful-*.pfscript` | Stateful 関数（呼吸・視線スプリング等）の断片例 |
| `pfscript-demo.pfpreset` | **Standard モデル**準拠の Preset v3（PFScript + Graph + blink/idle + thinking） |

### `pfscript-demo.pfpreset` の役割分担

| 層 | 担当 |
| ---- | ---- |
| **Graph** | `interest × 0.4 → mouthX`（笑顔） |
| **PFScript** | `mouthY = volume`、頭のゆらぎ、音素リップシンク |
| **behaviorPlugins** | `blink`（瞬き）、`idle`（低 interest 時の視線 wander） |
| **extensions** | `thinking` Motion Pack |

`lipsync-thinking.pfscript` をそのまま貼るのではなく、笑顔は Graph・thinking は extensions に分離した構成です。

## Studio で試す

1. `pnpm dev:studio` で Studio を起動
2. エキスパートモード → **PFScript** タブ
3. **サンプルを挿入** または `.pfscript` / `.pfpreset` をインポート
4. **Preset に適用** → Pipeline で確認

## CLI でコンパイル（開発者向け）

```bash
pnpm --filter @puppetflow/pfscript-core build
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { compileToBehaviorJson } from './packages/pfscript-core/dist/index.js';
const src = readFileSync('./examples/pfscript/basic-smile.pfscript', 'utf8');
console.log(compileToBehaviorJson(src));
"
```

## 関連ドキュメント

- [docs/reference/pfscript.md](../../docs/reference/pfscript.md)
- [docs/reference/presets.md](../../docs/reference/presets.md)
- [docs/adr/preset-canonical-model.md](../../docs/adr/preset-canonical-model.md)
- [docs/implementation-plan-pfscript.md](../../docs/implementation-plan-pfscript.md)
