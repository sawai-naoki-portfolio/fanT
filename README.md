# fanT

> **ポートフォリオ作品**（[作品一覧へ](https://github.com/sawai-naoki-portfolio)）。「fanT」はコードネームです。設計資料（市場調査・要件定義・システム構成・実装状況）は [`docs/`](docs/README.md) にあります。
>
> | 項目     | 内容                                                                                                                                                                               |
> | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | 開発     | 個人開発。企画・仕様決め・設計の判断・レビュー・テストでの検証は自分で行い、実装とドキュメント作成には生成 AI（Claude Code）を活用                                                 |
> | 開発時期 | 2026 年 10 月（コミットの記録: 2026/10/24〜10/31）                                                                                                                                 |
> | 公開状況 | 未公開・開発中。自動テスト・CI でのネイティブビルド・シミュレーターでの画面確認までで、**実機での動作確認はまだ**です（[実装状況](docs/requirements/08-implementation-status.md)） |

平成デジカメの質感で、ちゃんと盛れる加工カメラアプリ（コードネーム）。
フィルム / キャラ / プリ / AI の4モードを、1つのカメラにまとめます。

- [市場調査](docs/market-research/00-summary.md)
- [要件定義](docs/requirements/README.md)
- [システム構成](docs/requirements/07-system-architecture.md)

## リポジトリ構成

TypeScript のモノレポ（pnpm workspaces + Turborepo）です。

| パス                      | 内容                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile`             | Expo SDK 58（React Native）アプリ。カメラ・プリ・AI・編集・デコ・アルバム・課金・設定                                        |
| `apps/studio`             | フィルムスタジオ（社内ツール、Vite + React + CanvasKit）。アプリと同じシェーダーでフィルムを作り、JSON と LUT を書き出す     |
| `packages/filters`        | SkSL シェーダー（フィルム・美肌・日付印字・基本補正）とシェーダーの連結。Skia の実装に依存せず、アプリとスタジオで同じコード |
| `packages/content-schema` | 配信コンテンツ（フィルム・キャラ・台紙・スタンプ・AI スタイル）の型と検証（zod）                                             |
| `packages/api-types`      | アプリとサーバーの API の型と検証（zod）                                                                                     |
| `packages/config`         | 共有の tsconfig と ESLint 設定                                                                                               |
| `content/`                | 配信コンテンツの原本。`builtin/` はアプリに同梱、`remote/` は配信のみ                                                        |
| `functions/`              | Cloud Functions（AI 生成の中継・クレジット・購入 Webhook・分析の受け口）                                                     |
| `firebase/`               | Firestore / Storage のルールとインデックス                                                                                   |
| `.github/`                | CI・コンテンツ配信・依存関係の監査・Dependabot                                                                               |
| `docs/`                   | 市場調査・要件定義・[実装状況](docs/requirements/08-implementation-status.md)・[運用手順](docs/operations/README.md)         |

## 開発環境

- Node.js 24 LTS（`.node-version`）
- pnpm 12（`package.json` の `packageManager` で固定。`corepack enable` で自動的に使えます）

```sh
pnpm install          # 依存関係のインストール
pnpm check            # フォーマット・lint・型チェック・テストをまとめて実行（CI と同じ）
pnpm format           # Prettier で整形
```

### モバイルアプリ

```sh
pnpm --filter @fant/mobile start     # Metro を起動（開発ビルドで開く）
pnpm --filter @fant/mobile ios       # iOS の開発ビルドを作って起動（Xcode が必要）
pnpm --filter @fant/mobile android   # Android の開発ビルドを作って起動（Android Studio が必要）
pnpm --filter @fant/mobile bundle    # iOS / Android の JS バンドルを作成（CI でも実行）
pnpm --filter @fant/mobile check:native  # expo prebuild して、権限の設定を検査（CI でも実行）
```

- ビルドの種類は環境変数 `APP_VARIANT`（`development` / `preview` / `production`）で切り替えます。EAS のプロファイル（`apps/mobile/eas.json`）が自動で設定します。
- `ios/` と `android/` は Expo が生成するので、コミットしません。ネイティブの設定は `app.config.ts` と config plugin で行います。
- アイコンとスプラッシュは、デザインが決まってから追加します（要件定義 Q-02）。
- サーバーや課金の接続先は、ビルド時の環境変数で渡します（未設定の機能はオフになり、ほかの機能は動きます）。一覧は [運用手順](docs/operations/README.md) を参照してください。

### フィルムスタジオ・コンテンツ・サーバー

```sh
pnpm --filter @fant/studio dev             # フィルムスタジオを http://127.0.0.1:5173 で起動
pnpm --filter @fant/content generate:luts  # 内蔵フィルムの LUT を作り直す
pnpm --filter @fant/content hash           # 素材の SHA-256 を JSON に書き込む（素材を変えたら必ず実行）
pnpm --filter @fant/content build          # 配信用の manifest.json と素材を content/dist に作る
pnpm --filter @fant/functions build        # Cloud Functions を functions/dist にまとめる（firebase deploy が使う）
```

### 実機ビルド

VisionCamera や Skia などのネイティブモジュールを使うため、Expo Go では動きません。開発ビルド（`expo-dev-client` 入り）を実機にインストールして使います。

#### Android

| ツール               | バージョン    | 備考                                                                                |
| -------------------- | ------------- | ----------------------------------------------------------------------------------- |
| Android Studio       | 最新          | SDK Manager で下の SDK Platform と NDK を入れる                                     |
| JDK                  | 17            | Azul Zulu 17 を推奨（`winget install Azul.Zulu.17.JDK`）。React Native が 17 を指定 |
| Android SDK Platform | 37            | `platforms;android-37.0`（React Native 0.88 の `compileSdk`）                       |
| NDK                  | 27.1.12297006 | React Native 0.88 が指定するバージョン                                              |

環境変数 `ANDROID_HOME`（Windows では `%LOCALAPPDATA%\Android\Sdk`）と `JAVA_HOME`（JDK 17 のインストール先）を設定します。

Windows では、さらに次の設定が必要です。

- リポジトリを **ASCII 文字だけの短いパス**（例: `C:\dev\fanT`）に置く。日本語を含むパスは Android Gradle Plugin がエラーにし、NDK のビルドも失敗します。OneDrive などの同期フォルダも、ビルド成果物のロックで失敗するので避けます
- 長いパスを有効にする（`git config core.longpaths true` と、レジストリの `LongPathsEnabled`）
- **ninja を 1.12 以上にする**。pnpm の `node_modules` はパスが深く、CMake の依存ファイルが260文字を超えます。SDK の CMake 3.22.1 に同梱の ninja 1.10 は長いパスを扱えず、`manifest 'build.ninja' still dirty after 100 tries` で失敗します。SDK Manager で CMake 3.31.6 を入れ、同梱の `ninja.exe`（1.12.1）を `%ANDROID_HOME%\cmake\3.22.1\bin\` にコピーします（元のファイルは別名で残しておく）

1. 端末の「開発者向けオプション」で USB デバッグを有効にし、USB で接続する（`adb devices` で `device` と表示されれば OK）
2. `pnpm --filter @fant/mobile android` を実行する。接続中の端末向けにビルドしてインストールし、Metro を起動します。初回は C++ のビルドがあるため時間がかかります

#### iOS

Xcode が必要なので、Windows では EAS Build（クラウド）でビルドします。実機へのインストールには Apple Developer Program への登録が必要です。

```sh
npm install -g eas-cli
eas login
eas init                                         # 初回のみ。表示された projectId を app.config.ts の extra.eas.projectId に追加する
eas device:create                                # 端末の UDID を登録（表示される URL を iPhone で開く）
eas build --profile development --platform ios   # 完了後に表示される URL から iPhone にインストール
```

iPhone の「設定 > プライバシーとセキュリティ」でデベロッパモードを有効にしてから、`pnpm --filter @fant/mobile start` で Metro を起動して開きます。

## コードの規約

- **カメラのスレッドで動く関数（ワークレット）**には `'worklet';` を書き、そうした関数をまとめたファイルは `*.worklet.ts` と名付けます。ワークレットの Babel プラグインは関数宣言を巻き上げない変数に変えるため、補助関数を呼び出し元より後に書くと、カメラのスレッドで `undefined` になります。`packages/filters` と `*.worklet.ts` では、ESLint（`no-use-before-define`）がこれを検出します。
- **Skia のオブジェクト**（シェーダー・Paint・画像など）は、使い終わったらその場で `dispose()` します。ネイティブのメモリは JS のガベージコレクターに見えないため、放置するとメモリが増え続けます。
- React Native に依存しない純粋なロジックは、テスト（Vitest）を付けます。
- **カメラと描画のライブラリ**（VisionCamera・Skia・worklets）は `apps/mobile/src/engine/` からだけ使います（非機能要件 §8）。ESLint（`no-restricted-imports`）がほかの場所からの import を止めます。
- **外から来るデータはすべて検証してから使う**: ダウンロードしたコンテンツ（zod とハッシュ）、サーバーの応答、端末に保存した設定や写真のレシピ。壊れていても既定値や内蔵コンテンツで動き続けます。
- 画面の文言は `src/i18n/strings.ts` に集めます（英語への対応は辞書を足すだけにする）。

## 依存関係のルール

| 対象                                                    | 追加・更新の方法                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Expo / React Native 関連（アプリのみ）                  | `pnpm --filter @fant/mobile exec expo install <package>`（SDK と互換性のあるバージョンが選ばれる）    |
| 複数のパッケージで使うツール（TypeScript、ESLint など） | `pnpm-workspace.yaml` の `catalog` にバージョンを書き、各 `package.json` では `"catalog:"` を指定する |
| ワークスペース内のパッケージ                            | `"workspace:*"` で参照する                                                                            |

Expo SDK が決めるパッケージ（`expo*`、`react`、`react-native*`、`@shopify/react-native-skia` など）は Dependabot の対象外です。
React Native は `react` が内部のレンダラーと完全に一致しないと起動しないため、まとめて次のコマンドで更新します。CI は `expo install --check` で互換性を確認しています。

```sh
pnpm --filter @fant/mobile exec expo install --fix
```

### サプライチェーン対策（`pnpm-workspace.yaml`）

- **公開から24時間未満のバージョンは使わない**（`minimumReleaseAge`）
- **来歴証明（provenance）の信頼レベルが下がったバージョンは拒否する**（`trustPolicy: no-downgrade`）。例外は理由を書いて `trustPolicyExclude` に追加する
- **依存パッケージのビルドスクリプトは既定ですべて実行しない**。必要なものだけ `allowBuilds` で許可する
- **既知の脆弱性**: CI（毎週と lockfile の変更時）で `pnpm audit --audit-level high` を実行する。修正できないものは、影響範囲を確認したうえで GHSA 番号と理由を `audit.ignore` に記録し、Expo SDK を更新するたびに見直す

## CI

| ワークフロー     | 内容                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`         | フォーマット確認、Expo SDK との互換性、lint・型チェック・テスト、iOS / Android の JS バンドル、Functions / スタジオ / コンテンツのビルド、ネイティブの権限の検査 |
| `content.yml`    | `content/` の変更を検証して、コンテンツ用のバケット（CDN）へ配信（設定がある場合のみ）                                                                           |
| `security.yml`   | 依存関係の脆弱性監査（毎週月曜、lockfile 変更時）                                                                                                                |
| `dependabot.yml` | npm と GitHub Actions の更新（公開後3日の待機あり）                                                                                                              |

GitHub Actions はすべてコミット SHA で固定し、トークンは読み取り専用にしています。
