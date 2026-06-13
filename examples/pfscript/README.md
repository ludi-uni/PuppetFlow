# PFScript サンプル

PuppetFlow PFScript（Behavior DSL）の公式サンプルです。

## ファイル

| ファイル | 説明 |
| -------- | ---- |
| `basic-smile.pfscript` | State / Channel から mouth へマッピングする最小例 |
| `lipsync-thinking.pfscript` | 追加仕様のサンプル相当（リップシンク + 条件付き thinking） |
| `pfscript-demo.pfpreset` | `behaviorPfScript` 付き Preset v3 例 |

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
- [docs/implementation-plan-pfscript.md](../../docs/implementation-plan-pfscript.md)
