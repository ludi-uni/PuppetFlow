# リファクタリング計画（進捗）

PuppetFlow の Standard モデル（PFScript + Graph + blink/idle）を中心にした整理計画です。

## 完了済み

| フェーズ | 内容                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------- | ---- |
| **R0**   | overlap 検知、`collect-preset-motion-keys`、CI `build:presets`、ドキュメント一部                                          |
| **R1**   | Preset 正本 ADR、`materializePresetBehavior`、TS ビルドスクリプト、`pfscript-demo` Standard 化                            |
| **R2**   | Studio hook 分割（`usePresetState` / `useStudioMode` 等）、`features/{shared,simple,expert}/tabs` 整理、`App.tsx` slim 化 | 完了 |
| **R3**   | 複数 Plugin overlap 検知、レガシー案内 UI、ADR plugin-layer                                                               | 完了 |
| **R4**   | `legacy-call.ts` 削除、関数カタログ、`motionFunction` Graph 統合、Mapper custom 集約、Inochi2D ADR                        | 完了 |
| **R5**   | `overview.md` / `architecture.md` / `roadmap.md` ほかドキュメント同期                                                     | 完了 |

## 残タスク

| フェーズ     | タスク                                                     | 優先度 |
| ------------ | ---------------------------------------------------------- | ------ |
| **R3**       | `idle` 視線の PFScript `wander()` 移行（破壊的変更の評価） | P3     |
| **Phase 11** | Timeline Sources（Rhubarb / VOICEVOX 等）                  | P3     |
| **Phase 10** | npm 公開・コミュニティ Preset 配布                         | P3     |

## 設計原則（維持）

```text
State / Channel / Timeline
  → Plugins（blink, idle）
  → Behavior / PFScript
  → Graph（かんたんモード）
  → merge → Modifiers → Extensions → Adapters
```

詳細: [ADR: Preset 正本モデル](adr/preset-canonical-model.md)

## スコープ外

- Preset v4 新フィールド
- PFScript Phase 2（ローカル変数、式中 Pack 呼び出し）
- Playground / Editor の大規模 UI 変更
- `adapter-inochi2d` 新規パッケージ（[ADR](adr/motion-mapper-inochi2d.md) で live2d ターゲット継続を決定済み）
