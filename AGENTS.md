# AGENTS.md

このリポジトリでは、常に日本語で応答する。

## プロジェクト概要

`keiba-ai-assistant` は、個人利用のための競馬予想AIアシスタントである。

公開Webサービスではなく、ローカル環境で動作するWebアプリとして開発する。指定したレースについてnetKeibaをブラウザ操作で参照し、取得したページsnapshotをAIで構造化したうえで、ユーザー定義の予想方針に基づいてCodex SDKで分析する。分析結果はローカルブラウザで閲覧し、同じレースについて追加質問できるようにする。

## アーキテクチャ構成

- パッケージ管理はpnpm workspaceである。
- 実装言語はTypeScript 6系である。
- workspace内の実行・参照はTypeScriptソースを前提とし、内部packageは `dist/*.js` や `.d.ts` を公開面にしない。
- workspace packageの `exports` は `src/*.ts` を指す。
- 標準の品質確認は `typecheck`、`lint`、`test` で行い、`build` scriptは置かない。
- `apps/*` は必要に応じてアプリ成果物を生成してよいが、その場合は `bundle` など用途が分かるscript名を追加する。
- リンターはoxlint、フォーマッターはoxfmtである。
- ルートに置く外部依存はTypeScript、oxlint、oxfmt、Vitestである。
- その他の外部依存は、実際に利用するworkspace packageへ `pnpm --filter` で追加する。
- モノレポ構成は `apps/web`、`apps/cli`、`packages/models`、`packages/scraper`、`packages/ai`、`packages/storage` である。
- データモデルとZodスキーマは `packages/models` に集約する。
- netKeibaや天気情報の取得処理、ページsnapshot作成処理は `packages/scraper` に集約する。
- Codex SDKによるレースsnapshot構造化、分析処理、追加質問回答処理は `packages/ai` に集約する。
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
  vitest.config.ts

  apps/
    web/
      package.json
      vite.config.ts
      tsconfig.json
      src/
        server/
          app.ts
          root.tsx
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
          import-race.ts
          policy.ts
          analyze.ts
          ask.ts

  packages/
    models/
      package.json
      tsconfig.json
      src/
        bet-candidate.ts
        race.ts
        race-surface.ts
        weather.ts
        horse.ts
        race-draft-horse.ts
        race-draft.ts
        past-performance.ts
        pedigree.ts
        horse-evaluation.ts
        prediction.ts
        prediction-draft.ts
        qa.ts
        policy.ts
        source-page-link.ts
        source-page-snapshot.ts
        index.ts

    scraper/
      package.json
      tsconfig.json
      src/
        netkeiba/
          access-control.ts
          collector.ts
          browser.ts
          selectors.ts
          rate-limit.ts
          snapshot.ts
        weather/
          provider.ts
        index.ts

    ai/
      package.json
      tsconfig.json
      src/
        codex.ts
        extract-race.ts
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
        policy-store.ts
        qa-store.ts
        file-system.ts
        index.ts

  policies/
    main.md

  runs/
    .gitkeep

  data/
    .gitkeep

  fixtures/
    races/
      sample-race.json

  .agents/
    skills/
      unit-test-writer/
        SKILL.md
        agents/
          openai.yaml
```

## Webアプリ構成

- `apps/web` はHono、Inertia.js、Reactで構成する。
- HonoのInertia連携は `@hono/inertia` で行う。
- ローカル開発時のHono/Vite連携は `@hono/vite-dev-server` で行う。
- `apps/web/src/server/root.tsx` はHono JSXでroot HTMLを生成する。
- React Fast Refreshのpreambleは `apps/web/src/client.tsx` の `@vitejs/plugin-react/preamble` importで読み込む。
- React Compilerは `apps/web/vite.config.ts` で `@vitejs/plugin-react` の `reactCompilerPreset` と `@rolldown/plugin-babel` により有効化済みである。
- React Compilerが通常の描画最適化を担うため、Reactコンポーネントでは描画最適化だけを目的に `useMemo`、`useCallback`、`React.memo` を追加しない。参照同一性が外部APIの契約になる場合、計算が実測上重い場合、またはプロファイルで必要性が確認できた場合に限って手動メモ化を使う。
- 画面はサーバー駆動SPAとして扱う。
- レースページはHonoのサーバー側ルーティングからInertiaページとして描画する。
- API専用エンドポイントを増やしすぎず、画面遷移と表示データはサーバー側で管理する。
- 追加質問、分析実行、取得実行などの操作は必要に応じてHonoのrouteとして実装する。
- 外部公開を前提にした認証、マルチユーザー、公開デプロイ設定は追加しない。

## CLI構成

- `apps/cli` はローカル操作用の入口として実装する。
- Webサーバー起動、レース取得、分析、追加質問の実行をCLIから呼べるようにする。
- CLIはWeb固有のUI実装に依存せず、必要な `packages/*` の処理を呼び出す。

想定コマンド:

```text
keiba-ai-assistant serve
keiba-ai-assistant collect --race-url <url>
keiba-ai-assistant import-race --race-json <path> [--runs-dir <path>]
keiba-ai-assistant policy
keiba-ai-assistant analyze --race-id <race-id> [--model <model>] [--policy-path <path>] [--runs-dir <path>]
keiba-ai-assistant ask --race-id <race-id> [--model <model>] [--policy-path <path>] [--runs-dir <path>] <question>
keiba-ai-assistant qa-history --race-id <race-id> [--runs-dir <path>]
```

## コード品質設定

以下は `.oxlintrc.json`、`.oxfmtrc.json`、`tsconfig.base.json`、各package scriptに反映されている。

- 内部コードの相対import/exportは禁止し、`@keiba-ai-assistant/...` から始まるworkspace package importを使用する。
- 共有fixtureはworkspace packageではないため、`@fixtures/...` から始まるfixture専用importを使用する。
- TypeScriptのmodule resolutionはBundlerを使用し、内部import/exportでは拡張子なしのspecifierを使用する。
- TypeScriptの検査は `tsc --noEmit` で行う。package単位のJSや宣言ファイルは生成しない。
- ユニットテストはrootのVitestで実行し、`pnpm test` を使用する。
- 型だけを参照するimportは `import type` を使用する。
- importの重複は禁止する。
- 関数定義は原則として `function` 宣言ではなく `const` のarrow functionで書く。hoist、overload、フレームワーク制約など明確な理由がある場合だけ例外とする。
- 文字列リテラルはダブルクォートを使用する。
- ステートメント末尾のセミコロンは必須とする。
- 条件分岐とループのブロックは波括弧を必須とする。
- 等価比較は `===` / `!==` を使用する。
- Promiseを返す関数の呼び出し結果を `void` で破棄しない。必要に応じて `await`、`return`、または明示的なエラーハンドリングを使用する。
- `console` はCLIとサーバー起動ログなど、ローカル実行入口に限って許可する。

## コメント方針

- コメントは日本語で書く。
- top-levelの関数、exportする関数、テスト補助関数にはdocコメントを置く。
- interface、type、schema、公開される定数には、役割が読み取れるdocコメントを置く。
- interfaceやschemaの各プロパティには、その値が何を表すか分かるコメントを置く。
- 処理内コメントは、処理順、設計意図、副作用、外部I/O、AI実行、ブラウザ操作、保存前検証、安全設定など、読み手が誤解しやすい箇所に置く。
- コードをそのまま言い換えるだけのコメントは置かない。
- コメントは現在の実装事実と意図を説明する。過去の経緯、検討過程、不要になった代替案は書かない。
- 実装を変更したときは、関連するコメントも同じ変更の一部として更新する。

## Scraper責務

`packages/scraper` には、外部情報を取得してAI構造化用の軽量ページsnapshotを作る処理を置く。

- netKeibaブラウザ操作
- アクセス制御
- netKeibaページの可視テキスト、見出し、表、リンクからなる軽量snapshot作成
- レースページ内の馬リンクから馬詳細ページへ1件ずつ遷移し、過去走と血統を含む軽量snapshot作成
- 天気情報取得

`packages/scraper` はHTML、生DOM、スクリーンショットを保存せず、AI構造化に必要な最小限の `SourcePageSnapshot` を返す。保存処理は `packages/storage` に委ねる。

Playwright の Chromium ブラウザ本体は初回実行前に `pnpm --filter @keiba-ai-assistant/scraper exec playwright install chromium` でインストールする。

## AIパッケージ責務

`packages/ai` には、Codex SDKによる分析処理を置く。

- Codex SDK連携
- ページsnapshotから `RaceDraft` への構造化
- 予想プロンプト生成
- レース分析
- 追加質問への回答生成

`packages/ai` はページsnapshot、構造化済みデータ、予想方針を入力として受け取り、Race、予想結果、Q&A回答を返す。保存処理は `packages/storage` に委ねる。

## Storage責務

`packages/storage` には、ローカルファイルの読み書きを置く。

- `runs/` の読み書き
- `data/` の読み書き
- `policies/main.md` の読込
- `race.json` の保存と読込
- `prediction.json` の保存と読込
- `qa.jsonl` の追記と読込
- `thread.json` と `metadata.json` の保存と読込
- ファイル存在確認や ENOENT 判定など、ローカルファイルI/Oの共通処理

`packages/storage` は永続化形式を隠蔽し、web/cliや他パッケージがファイルパスの詳細に依存しすぎないようにする。

## Models責務

`packages/models` には、アプリ全体で共有するデータモデルとZodスキーマを置く。

- レースデータ
- 馬データ
- 予想結果
- Q&A履歴
- 予想方針

`packages/models` は副作用を持たない純粋な型・スキーマ定義パッケージとして扱う。ファイルI/O、ブラウザ操作、Codex SDK呼び出し、Hono/React依存を入れない。

`packages/models/src` は1スキーマ1ファイルで構成する。各モデルファイルは `xxxSchema`、`Xxx` 型、`parseXxx(value: unknown): Xxx` を export する。Zodスキーマ値は値として扱い、lower camel caseで命名する。モデル項目には、その項目が何を表すか分かるコメントを置く。

## AI分析仕様

- AI分析にはCodex SDKを使用する。
- netKeiba取得では、ブラウザ操作で得た `SourcePageSnapshot` をCodex SDKに渡し、`RaceDraft` JSONとして構造化する。
- `collect` は `--horse-detail-limit` で馬詳細ページへの遷移件数を制御する。0の場合は馬詳細ページを取得しない。
- `packages/ai` の Codex SDK runtime は `@openai/codex-sdk` を使用し、分析時は `packages/models` の `predictionDraftSchema` から生成した structured output schema を渡して `PredictionDraft` 形式のJSON出力を要求する。
- Codex SDK分析は、ローカルPCに導入済みでChatGPTログイン済みのCodex CLIを前提にする。
- Codex SDKにはAPI keyや独自の環境変数を渡さず、Codex CLIの通常の認証状態を使用する。
- `generatedAt` はAIに生成させず、Codex SDKから返った `PredictionDraft` にアプリ側で付与して `Prediction` とする。
- netKeiba取得の `sourceUrl` と `collectedAt` はAIに生成させず、ブラウザ操作で得た `SourcePageSnapshot` からアプリ側で付与して `Race` とする。
- netKeiba取得の出走馬ごとの馬体重、馬体重増減、オッズ、人気はレースページsnapshotから `RaceDraftHorse` に構造化し、不明な値は `null` とする。
- `RaceDraftHorse` の `null` 数値項目は保存用 `Race` へ変換するときに省略し、`Horse` の任意項目として扱う。
- `betCandidates[].stakeWeight` は買い目全体を100とした0から100の整数とする。
- Codex SDKから返った値は保存前に必ず `parsePrediction` を通す。
- Codex SDKから返った `RaceDraft` は `parseRaceDraft` を通し、`Race` として保存する前に必ず `parseRace` を通す。
- 追加質問では、AIには `QaAnswerDraft` として回答本文だけを生成させ、`QaEntry` の `id`、`raceId`、`question`、`createdAt` はアプリ側で付与する。
- 分析用 Codex SDK thread はファイル変更を行わない前提で `read-only` sandbox、`approvalPolicy: "never"`、`webSearchMode: "disabled"` を使用する。
- Webページを直接AIに読ませて予想させず、ブラウザ操作で作った軽量snapshotを `RaceDraft` に構造化し、`Race` として検証してから分析する。
- 予想方針は `policies/main.md` に記述する。
- 分析時には、構造化レースデータ、予想方針、必要に応じて過去のQ&A履歴をCodex SDKに渡す。
- Codex SDKの出力は `prediction.json` や `qa.jsonl` として保存できる形にする。
- 追加質問では、対象レースの `race.json`、`prediction.json`、`qa.jsonl`、`policies/main.md` を参照する。

## データ取得仕様

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
- 馬体重と増減
- オッズ
- 人気
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

## ローカルデータ仕様

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

## Fixture仕様

開発用の架空レースデータは `fixtures/races/` に置く。fixture は実在レース由来の情報を含めず、`packages/models` のZodスキーマで検証できる形にする。共有fixtureを参照する場合は `@fixtures/...` importを使用する。

## テスト仕様

Vitest はrootの開発依存として管理し、workspace全体のテストは `pnpm test` で実行する。ユニットテストを書く際は `.agents/skills/unit-test-writer` の方針に従う。

テストファイルは原則として実装ファイルと同じディレクトリに `{実装ファイル名}.test.ts` または `{実装ファイル名}.test.tsx` として置く。テストでは `it()` ではなく `test()` を使い、テスト名は日本語で書く。各テストは `// Arrange`、`// Act`、`// Assert` コメントで構成する。

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

## UI仕様

- レースレポートはローカルブラウザで閲覧する。
- レポート画面から同じレースについて追加質問できるようにする。
- 追加質問への回答はCodex SDKで生成し、レース単位のQ&A履歴として保存する。
- レポートには取得元URL、取得日時、私的利用目的で生成された旨を記録する。
- レポートは外部公開、転載、配布を前提としない。

## 実装時の注意

- 既存ファイルを編集する前には必ず読み直す。
- `.serena` ディレクトリが存在する場合は、コード参照と修正にSerena MCP Serverを使用する。
- 実装タスクを終える前には必ず `pnpm lint` と `pnpm typecheck` を実行する。
- テストを追加または変更した場合は `pnpm test` も実行する。
- 型定義とZodスキーマは `packages/models` を中心に置き、入出力境界で検証する。
- `packages/*` にUI依存を入れない。
- `apps/web` 固有のReactコンポーネントを `packages/*` に置かない。
- netKeibaアクセス制御をバイパスするショートカットを作らない。
- ローカル私用の前提を崩す機能を追加しない。
