# ドキュメント

加工カメラアプリ開発プロジェクトのドキュメント置き場です。

## 構成

```
docs/
├── README.md                    … このファイル（目次）
├── market-research/             … 市場調査（2026-10-24 時点）
│   ├── 00-summary.md            … エグゼクティブサマリー
│   ├── 01-market-size.md        … 市場規模・成長性
│   ├── 02-competitors.md        … 競合分析（グローバル / 日本 / 価格比較）
│   ├── 03-user-trends.md        … ユーザー・トレンド（日本・Z世代）
│   ├── 04-ai-trends.md          … AI 画像トレンドとバイラル事例
│   ├── 05-monetization.md       … マネタイズ・課金ベンチマーク
│   ├── 06-regulation.md         … 規制・制度環境
│   ├── 07-technology.md         … 技術動向（SDK / 端末上 AI / クロスプラットフォーム）
│   ├── 08-strategy.md           … SWOT・ポジショニング・推奨戦略
│   └── sources.md               … 出典一覧
├── requirements/                … 要件定義（v0.3）
│   ├── 01-product-overview.md
│   ├── 02-functional-requirements.md
│   ├── 03-non-functional-requirements.md
│   ├── 04-monetization.md
│   ├── 05-screens.md
│   ├── 06-open-issues.md
│   ├── 07-system-architecture.md
│   └── 08-implementation-status.md … 実装状況と実機で確認すること
└── operations/                  … 運用手順
    └── README.md                … 環境変数・Firebase・RevenueCat・コンテンツ配信・リリース前の確認
```

## データの扱い

- 市場調査は公開情報（調査会社のレポート概要、プレスリリース、報道、ストア掲載情報）から作りました。Sensor Tower / AppMagic などの有料ツールの生データは使っていません。
- 数値の多くは推計値、または小規模アンケートの結果です。**方向性を見るためのもの**として扱い、重要な意思決定の前には一次ソースで確認してください。
- 各ファイル末尾の `[S-xx]` は [sources.md](market-research/sources.md) の出典番号です。
