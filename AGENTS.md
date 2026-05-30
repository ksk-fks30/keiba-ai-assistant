# AGENTS.md

このリポジトリでは、常に日本語で応答する。

## プロジェクト概要

`keiba-ai-assistant` は、個人利用のための競馬予想AIアシスタントである。

公開Webサービスではなく、ローカル環境で動作するWebアプリとして開発する。指定したレースについてnetKeibaをブラウザ操作で参照し、取得した情報を構造化したうえで、ユーザー定義の予想方針に基づいてCodex SDKで分析する。分析結果はローカルブラウザで閲覧し、同じレースについて追加質問できるようにする。

## アーキテクチャ方針

- パッケージ管理はpnpm workspaceを使用する。
- 実装言語はTypeScript 6系を基本とする。
- リンターはoxlintを使用する。
- モノレポ構成は `apps/web`、`apps/cli`、`packages/models`、`packages/scraper`、`packages/ai`、`packages/storage` を基本とする。
- データモデルとZodスキーマは `packages/models` に集約する。
- netKeibaや天気情報の取得処理は `packages/scraper` に集約する。
- Codex SDKによる分析処理は `packages/ai` に集約する。
- `runs/` と `data/` の読み書きは `packages/storage` に集約する。
- `apps/web` と `apps/cli` は各 `packages/*` に依存してよい。
- `packages/scraper`、`packages/ai`、`packages/storage` は `packages/models` に依存してよい。
- `packages/models` は他のworkspace packageに依存してはならない。
- `packages/*` は `apps/web` や `apps/cli` に依存してはならない。

想定するディレクトリ構成:

```text
keiba-ai-assistant/
  README.md
  AGENTS.md
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  .gitignore
  .env.example

  apps/
    web/
      package.json
      vite.config.ts
      tsconfig.json
      src/
        server/
          app.ts
          renderer.ts
          routes/
            home.ts
            races.ts
            collect.ts
            analyze.ts
            ask.ts
        pages/
          Home.tsx
          races/
            Index.tsx
            Show.tsx
        components/
          layout/
            AppLayout.tsx
          race/
            RaceSummary.tsx
            PredictionSummary.tsx
            HorseList.tsx
            HorseEvaluation.tsx
            QuestionPanel.tsx
            QuestionHistory.tsx
        styles/
          app.css

    cli/
      package.json
      tsconfig.json
      src/
        index.ts
        commands/
          serve.ts
          collect.ts
          analyze.ts
          ask.ts

  packages/
    models/
      package.json
      tsconfig.json
      src/
        race.ts
        horse.ts
        prediction.ts
        qa.ts
        policy.ts
        index.ts

    scraper/
      package.json
      tsconfig.json
      src/
        netkeiba/
          collector.ts
          browser.ts
          selectors.ts
          rate-limit.ts
        weather/
          provider.ts
        index.ts

    ai/
      package.json
      tsconfig.json
      src/
        codex.ts
        prompts.ts
        analyze-race.ts
        ask-race.ts
        index.ts

    storage/
      package.json
      tsconfig.json
      src/
        run-store.ts
        cache-store.ts
        qa-store.ts
        index.ts

  policies/
    main.md

  runs/
    .gitkeep

  data/
    .gitkeep
```

## Webアプリ方針

- `apps/web` はHono、Inertia.js、Reactで実装する。
- HonoのInertia連携には `@hono/inertia` を使用する。
- 画面はサーバー駆動SPAとして扱う。
- レースページはHonoのサーバー側ルーティングからInertiaページとして描画する。
- API専用エンドポイントを増やしすぎず、画面遷移と表示データはサーバー側で管理する。
- 追加質問、分析実行、取得実行などの操作は必要に応じてHonoのrouteとして実装する。
- 外部公開を前提にした認証、マルチユーザー、公開デプロイ設定は追加しない。

## CLI方針

- `apps/cli` はローカル操作用の入口として実装する。
- Webサーバー起動、レース取得、分析、追加質問の実行をCLIから呼べるようにする。
- CLIはWeb固有のUI実装に依存せず、必要な `packages/*` の処理を呼び出す。

想定コマンド:

```text
keiba-ai-assistant serve
keiba-ai-assistant collect --race-url <url>
keiba-ai-assistant analyze --race-id <race-id>
keiba-ai-assistant ask --race-id <race-id> <question>
```

## Scraper方針

`packages/scraper` には、外部情報を取得して `packages/models` の構造に変換する処理を置く。

- netKeibaブラウザ操作
- アクセス制御
- レースデータの構造化
- 天気情報取得

`packages/scraper` はデータ取得と構造化までを責務とし、保存処理は `packages/storage` に委ねる。

## AIパッケージ方針

`packages/ai` には、Codex SDKによる分析処理を置く。

- Codex SDK連携
- 予想プロンプト生成
- レース分析
- 追加質問への回答生成

`packages/ai` は構造化済みデータと予想方針を入力として受け取り、予想結果やQ&A回答を返す。保存処理は `packages/storage` に委ねる。

## Storage方針

`packages/storage` には、ローカルファイルの読み書きを置く。

- `runs/` の読み書き
- `data/` の読み書き
- `race.json` の保存と読込
- `prediction.json` の保存と読込
- `qa.jsonl` の追記と読込
- `thread.json` と `metadata.json` の保存と読込

`packages/storage` は永続化形式を隠蔽し、web/cliや他パッケージがファイルパスの詳細に依存しすぎないようにする。

## Models方針

`packages/models` には、アプリ全体で共有するデータモデルとZodスキーマを置く。

- レースデータ
- 馬データ
- 予想結果
- Q&A履歴
- 予想方針

`packages/models` は副作用を持たない純粋な型・スキーマ定義パッケージとして扱う。ファイルI/O、ブラウザ操作、Codex SDK呼び出し、Hono/React依存を入れない。

## AI分析方針

- AI分析にはCodex SDKを使用する。
- Webページを直接AIに読ませて予想させず、取得済みデータを `packages/models` のZodスキーマに沿って構造化してから分析する。
- 予想方針は `policies/main.md` に記述する。
- 分析時には、構造化レースデータ、予想方針、必要に応じて過去のQ&A履歴をCodex SDKに渡す。
- Codex SDKの出力は `prediction.json` や `qa.jsonl` として保存できる形にする。
- 追加質問では、対象レースの `race.json`、`prediction.json`、`qa.jsonl`、`policies/main.md` を参照する。

## データ取得方針

- 主データソースはnetKeibaとする。
- netKeibaの利用はグレー領域を含むため、ローカル私用・低頻度・低負荷を前提にする。
- CAPTCHA、ログイン、有料導線、アクセス制限を回避する実装は行わない。
- 通信制限、警告、異常レスポンスを検知した場合は取得を停止する。
- 天気情報はnetKeibaとは別の情報源から取得する。

取得対象:

- レース場
- 距離
- 芝またはダート
- 出走馬一覧
- 各馬の過去走
- 血統
- 騎手
- 調教師
- 馬体重
- オッズ
- 天気

## アクセス制御

- 並列アクセスは行わない。
- ページ取得は1ページずつ順番に行う。
- ページ遷移ごとに待機時間を入れる。
- 待機時間は設定可能にする。
- 同じURLはキャッシュし、不要な再取得を避ける。
- 複数レースの一括巡回は行わない。
- 短時間に複数回のリクエストを発生させない。
- 失敗時のリトライ回数には上限を設ける。

## ローカルデータ方針

レース単位の実行結果は `runs/` に保存する。

```text
runs/
  <race-id>/
    race.json
    prediction.json
    qa.jsonl
    thread.json
    metadata.json
```

取得キャッシュやブラウザ関連の一時データは `data/` に保存する。

```text
data/
  cache/
    netkeiba/
  browser/
```

`runs/` と `data/` の中身はGit管理しない。`.gitkeep` のみGit管理してよい。

`.gitignore` には最低限以下を含める。

```gitignore
node_modules/
dist/
.env
runs/*
!runs/.gitkeep
data/*
!data/.gitkeep
```

## 公開・保存してはいけないもの

- 取得済みのnetKeiba由来データ
- 生成された実レースのレポート
- netKeiba由来のHTML
- netKeiba由来の画像
- netKeibaのスクリーンショット
- 馬柱の再現データ
- ブラウザセッション
- Cookie
- 認証情報
- `.env`

公開リポジトリに含めてよいのは、ソースコード、設定例、テンプレート、架空データのサンプルのみとする。

## UI方針

- レースレポートはローカルブラウザで閲覧する。
- レポート画面から同じレースについて追加質問できるようにする。
- 追加質問への回答はCodex SDKで生成し、レース単位のQ&A履歴として保存する。
- レポートには取得元URL、取得日時、私的利用目的で生成された旨を記録する。
- レポートは外部公開、転載、配布を前提としない。

## 実装時の注意

- 既存ファイルを編集する前には必ず読み直す。
- `.serena` ディレクトリが存在する場合は、コード参照と修正にSerena MCP Serverを使用する。
- 型定義とZodスキーマは `packages/models` を中心に置き、入出力境界で検証する。
- `packages/*` にUI依存を入れない。
- `apps/web` 固有のReactコンポーネントを `packages/*` に置かない。
- netKeibaアクセス制御をバイパスするショートカットを作らない。
- ローカル私用の前提を崩す機能を追加しない。
