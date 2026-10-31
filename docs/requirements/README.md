# 要件定義

市場調査（[../market-research](../market-research/00-summary.md)）をもとに要件を定義します。
版: v0.2（2026-10-24）

| ファイル                                                               | 内容                                                                                                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01-product-overview.md](01-product-overview.md)                       | 背景・目的・コンセプト・ターゲット・スコープ・KPI・マイルストーン                                                                                                                                 |
| [02-functional-requirements.md](02-functional-requirements.md)         | 機能要件（ID・優先度付き）                                                                                                                                                                        |
| [03-non-functional-requirements.md](03-non-functional-requirements.md) | 非機能要件（性能・画質・セキュリティ・プライバシー・未成年への配慮）                                                                                                                              |
| [04-monetization.md](04-monetization.md)                               | 課金・価格設計（フリーミアム＋AI クレジット）                                                                                                                                                     |
| [05-screens.md](05-screens.md)                                         | 画面一覧・画面遷移・カメラ画面のレイアウト案                                                                                                                                                      |
| [06-open-issues.md](06-open-issues.md)                                 | 決定事項・未決事項・リスク・スコープを削る順番                                                                                                                                                    |
| [07-system-architecture.md](07-system-architecture.md)                 | システム構成: TypeScript モノレポ（Expo / React Native ＋ VisionCamera ＋ Skia ＋ ネイティブモジュール ＋ React Web ＋ Firebase）、描画パイプライン、リポジトリ構成、技術検証の項目、実装との差分 |
| [08-implementation-status.md](08-implementation-status.md)             | 実装状況: 要件ごとの状況、非機能要件、実機で確認すること                                                                                                                                          |

## 改訂履歴

| 版   | 日付       | 内容                                                                                                                                                                                                   |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v0.1 | 2026-10-24 | 初版ドラフト（Flutter で両 OS）                                                                                                                                                                        |
| v0.2 | 2026-10-24 | 技術構成を TypeScript モノレポに変更（Expo / React Native ＋ VisionCamera ＋ Skia ＋ ネイティブモジュール ＋ React Web ＋ Firebase）。シェーダーを SkSL の1ソースに統一。フィルムスタジオ（STU）を追加 |
| v0.3 | 2026-10-27 | MVP を実装。決定事項 D-10〜D-15、実装との差分（07 §11）、実装状況（08）を追加                                                                                                                          |
