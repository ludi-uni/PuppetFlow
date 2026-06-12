# MotionState

`@puppetflow/core` が定義する、キャラクター向けの正規化モーションパラメータです。値は原則 **0.0〜1.0**（`clamp01` でクランプ）です。

ソース: `packages/core/src/motion-state.ts`

## キー一覧（16 種）

| カテゴリ     | キー                                 | 説明                                                     |
| ------------ | ------------------------------------ | -------------------------------------------------------- |
| 顔の向き     | `faceYaw`, `facePitch`, `faceRoll`   | 顔の回転（デフォルト 0.5 = ニュートラル）                |
| 体の向き     | `bodyYaw`, `bodyPitch`, `bodyRoll`   | 体の回転                                                 |
| 目（ボール） | `eyeYaw`, `eyePitch`, `eyeX`, `eyeY` | 眼球方向（VMC では同一パラメータにマップされる場合あり） |
| 口           | `mouthX`, `mouthY`                   | 口形・開き（デフォルト 0）                               |
| 頭・体       | `headTilt`, `bodyLean`               | 首傾き・体の前後傾き                                     |
| 視線         | `lookX`, `lookY`                     | 視線ターゲット（gaze / idle Builtin が主に使用）         |

## 廃止したキー（vNext）

以下は **Motion Mapper 上で `mouthX` / `mouthY` / `facePitch` 等と重複** していたため削除しました。Preset や Graph では置き換え先を使ってください。

| 廃止キー                        | 置き換え                            |
| ------------------------------- | ----------------------------------- |
| `smile`, `eyeSmile`             | `mouthX`                            |
| `mouthOpen`                     | `mouthY`                            |
| `eyeOpen`, `browUp`, `browDown` | `facePitch`（表情・瞬きの簡略表現） |

## マージ規則

Behavior / Graph / 旧式テスト用 Plugin の出力は `mergeMotionState` で統合されます。同一キーに複数の部分出力がある場合は平均されます。

## Adapter への変換

`@puppetflow/motion-mapper` が MotionState をモデル固有の OSC パラメータ名に変換します。マッピングは Studio の **Motion Mapper** タブ、または `profiles/*.json` で定義します。
