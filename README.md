# keiba-ai-assistant

個人利用のための競馬予想AIアシスタントです。

指定したレースについてローカル環境で情報を取得し、ユーザー定義の予想方針に基づいて分析します。分析結果はローカルブラウザで閲覧でき、同じレースについて追加質問できます。

現時点で対応しているAIエージェントは Codex のみです。PCに Codex CLI が導入済みで、通常どおり使える状態であれば、このアプリからそのまま利用できます。

> [!WARNING]
> **免責事項**
>
> 本プロジェクトは、競馬予想を個人で楽しむことを目的としたローカルツールです。netkeiba 様のページをブラウザ操作で参照しますが、取得は低頻度・低負荷となるようページ遷移ごとに間隔を設け、取得結果はローカル環境にのみ保存します。
>
> 取得データ、生成レポート、ブラウザセッション、キャッシュ、スクリーンショット等は公開・配布しません。また、CAPTCHA、ログイン、有料導線、アクセス制限の回避を目的とした利用は行わないでください。
>
> 本リポジトリの利用、改変、再配布によって発生した問題について、作者は責任を負いません。
>
> **Disclaimer**
>
> This project is a local tool intended for personal enjoyment of horse-racing predictions. It refers to netkeiba pages through browser automation, but accesses pages at low frequency and low load by waiting between page transitions, and stores collected results only in the local environment.
>
> Collected data, generated reports, browser sessions, caches, screenshots, and similar artifacts are not published or distributed. Do not use this project to bypass CAPTCHA, login requirements, paid content paths, or access restrictions.
>
> The author assumes no responsibility for any issues caused by use, modification, or redistribution of this repository.

## 主な機能

- レースURLを指定して対象レースを登録します。
- ブラウザ操作によりレース情報を取得します。
- レース場、距離、芝/ダート、回り方向、コース表記、出走馬、過去走、血統、騎手、調教師、性齢、馬体重、オッズ、Open-Meteo由来の天気などを分析材料として扱います。
- ユーザーの予想方針をもとにAI分析を行います。
- AI分析は、ローカルPCに導入済みのCodex CLIとそのログイン状態を使用します。
- レースごとの予想レポートをローカルブラウザで閲覧します。
- レポート画面から同じレースについて追加質問できます。
- 追加質問と回答の履歴をレース単位で保持します。

## 技術スタック

| 技術                        | 用途                                                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript / pnpm workspace | アプリ、CLI、共通パッケージを管理するモノレポ基盤です。                                                                                                     |
| Hono / Inertia.js / React   | ローカルWebアプリをサーバー駆動SPAとして構成します。                                                                                                        |
| Tailwind CSS v4 / Vite      | Web UIのスタイリングと開発サーバーを担当します。                                                                                                            |
| Codex / `@openai/codex-sdk` | レースのスナップショットの構造化、予想分析、追加質問回答を行うAI実行基盤です。ローカルPCのCodex CLIログイン状態を使い、指定したJSON形式で結果を生成します。 |
| Playwright Chromium         | netkeibaページをブラウザ操作で参照し、AI構造化用の軽量スナップショットを作成します。                                                                        |
| Zod                         | Race、Prediction、Q&Aなどの入出力を検証します。                                                                                                             |
| Open-Meteo Forecast API     | レース場と発走時刻に応じた天気情報を取得します。                                                                                                            |

## 予想方針

ユーザーの予想方針は `policies/main.md` に記述します。

予想方針には、重視する観点、軽視する観点、距離適性や馬場適性の見方、血統の扱い、人気馬や穴馬の評価方針、買い目の考え方などを記述します。

## レースデータ

レースごとの実行結果は `runs/` に保存します。

```text
runs/
  <race-id>/
    race.json
    prediction.json
    qa.jsonl
    thread.json
    metadata.json
```

取得キャッシュやブラウザ関連の一時データは `data/` に保存します。

`runs/` と `data/` の中身はGit管理しません。

## 初回セットアップ

WebとCLIのどちらを使う場合も、依存パッケージとPlaywright Chromiumをインストールします。

```sh
pnpm install
pnpm --filter @keiba-ai-assistant/scraper exec playwright install chromium
```

## Web

Webは、レース取得から分析結果の確認、追加質問までをブラウザ上で扱うための通常利用向け画面です。CLIのように細かい実行オプションを指定するよりも、保存済みレースを一覧から選び、レース単位の情報を見返しながら予想を確認する使い方を想定しています。

トップ画面では、netkeibaのレースURLを入力してレース解析を開始できます。解析中はジョブの進捗を確認でき、完了後は保存済みレース一覧から詳細画面へ移動できます。

レース詳細画面では、レース条件、天気、取得元URL、出走馬一覧、馬体重、人気、オッズ、血統、過去走をまとめて確認できます。右側のAIパネルでは、総評、馬別評価、リスク、買い目候補、追加質問の履歴を表示し、そのまま同じレースについて追加質問できます。`runs/` 配下のJSONを直接開かなくても、取得結果、分析結果、Q&A履歴を一つの画面で追えるのがWeb画面の利点です。

ローカルWebアプリは次のコマンドで起動します。

```sh
pnpm keiba:web
```

起動後、ターミナルに表示されるローカルURLをブラウザで開きます。

## CLI

Webがブラウザ上での閲覧と基本操作を想定しているのに対し、CLIは取得件数、待機時間、利用モデル、保存先、予想方針ファイルなどを指定して、取得・分析条件を細かく調整しながら実行するための入口です。

CLIは `pnpm keiba:cli <command>` の形式で実行します。

```sh
pnpm keiba:cli collect "<race-url>"
pnpm keiba:cli predict "<race-url>"
pnpm keiba:cli import-race <path>
pnpm keiba:cli policy
pnpm keiba:cli analyze <race-id>
pnpm keiba:cli ask <race-id> "<question>"
pnpm keiba:cli qa-history <race-id>
```

`predict` はレース取得、`race.json` 保存、AI分析、`prediction.json` 保存をまとめて実行します。
取得、AI構造化、天気取得、分析、保存などの長時間処理では、進捗が標準出力に表示されます。
`collect` は既定でheadlessブラウザを使い、ブラウザ画面を見たい場合は `--show-browser` を指定します。

### 主なオプション

```sh
pnpm keiba:cli collect "<race-url>" --horse-detail-limit 3 --min-delay-ms 2000
pnpm keiba:cli predict "<race-url>" --model <model> --policy-path policies/main.md
pnpm keiba:cli analyze <race-id> --runs-dir runs
pnpm keiba:cli ask <race-id> "<question>" --model <model>
```

レースURL、レースID、レースJSONのパスは、基本的にコマンド直後の引数として指定します。既存の実行方法との互換性のため、`collect` / `predict` では `--race-url <url>`、`analyze` / `ask` / `qa-history` では `--race-id <race-id>`、`import-race` では `--race-json <path>` でも同じ値を指定できます。

`--model <model>` は、Codex SDKに渡すモデル名です。省略した場合は、Codex CLI / SDK 側の既定モデルを使用します。
