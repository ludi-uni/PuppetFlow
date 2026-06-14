# ADR: Motion Mapper — Inochi2D / nijiexpose プロファイル

## 状況

- Studio の **nijiexpose** プリセットは Mapper ターゲット `live2d` を有効化する
- 既定プロファイル `live2d.json` と `vmc.json` は **同一の `Param*` 名** を使用する
- Inochi2D の内部パラメータ名はモデル依存だが、nijiexpose / nijilive 連携では Live2D 互換の `ParamAngleY` 等を OSC で受け付ける

## 決定

**専用 `inochi2d` Mapper ターゲットは Phase R4 では追加しない。**

| 項目 | 方針 |
| ---- | ---- |
| nijiexpose 向け送信 | 既存 `live2d` ターゲット + `viewer-presets.ts` の nijiexpose プリセット |
| パラメータ名 | `packages/motion-mapper/profiles/live2d.json` の `Param*` マッピングを正とする |
| 将来 | モデル固有マッピングが必要になった時点で `adapter-inochi2d` または `inochi2d` プロファイルを別 Epic で検討 |

## 理由

1. 現行 Viewer 連携は `Param*` 名で動作確認済み
2. `vmc` / `live2d` の重複はプロトコル互換の意図的共有（integrity テストで OSC 名の一意性のみ保証）
3. 別ターゲット追加は Studio UI・型・CI の変更コストが大きい

## 影響

- かんたんモード「nijiexpose」は引き続き `live2d` を primary とする
- カスタム Inochi2D パラメータは Mapper の **custom パラメータ** で手動追加

## 関連

- [Studio ガイド — Motion Mapper](../guides/studio.md)
- `apps/studio/src/constants/viewer-presets.ts`
