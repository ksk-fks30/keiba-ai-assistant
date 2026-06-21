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

ユーザーの予想方針は `policies/` 直下の `.md` ファイルに記述します。

ファイル名は任意で、読み込み順はファイル名のアルファベット順です。複数ファイルに分けて、重視する観点、軽視する観点、距離適性や馬場適性の見方、血統の扱い、人気馬や穴馬の評価方針、買い目の考え方などを記述できます。

予想方針 `.md` と追加質問には、競馬予想に関係する内容だけを入力してください。AIには、競馬予想と関係しない内容や、プロンプト、システム指示、秘密情報の表示・変更を求める内容に従わないよう指示しています。

実際に使う `.md` ファイルはGit管理しません。書き方の例は `policies/policy.md.example` を参考にしてください。

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

## 騎手リーディングデータ

騎手成績の補助情報は `data/jockey-leading.json` に保存します。

このファイルは、JRA騎手リーディングを予想時の補助軸として使うためのローカルデータです。分析時には全件をそのままAIに渡さず、対象レースに出走する騎手だけを抽出して、順位、勝率、連対率、複勝率、芝/ダート成績などの短い参照情報としてプロンプトへ渡します。

`data/jockey-leading.json` はGit管理しません。更新日ごとにファイルを増やすのではなく、常にこの1ファイルを上書きして使います。新しいデータを取得した場合は、同じファイル名のまま内容を更新してください。

通常は `data/jockey-leading.json` が既定の参照先です。別のファイルで一時的に試したい場合は、環境変数またはCLIオプションで上書きできます。

```sh
KEIBA_JOCKEY_LEADING_REFERENCE_PATH=/path/to/jockey-leading.json pnpm keiba:web
pnpm keiba:cli predict "<race-url>" --jockey-leading-reference-path /path/to/jockey-leading.json
pnpm keiba:cli analyze <race-id> --jockey-leading-reference-path /path/to/jockey-leading.json
```

参照ファイルが存在しない場合、分析自体は止めず、騎手リーディングなしで予想します。JSONの構造が壊れている場合は、誤った数値をAIに渡さないためエラーにします。

### JSONの書き方

トップレベルには、データの基準日、取得元情報、騎手行の配列を入れます。

```json
{
  "dataAsOf": "2026-06-14",
  "source": "netkeiba JRA騎手リーディング",
  "sourceUrl": "https://db.netkeiba.com/jockey/jockey_leading_jra.html",
  "netkeibaLabel": "2026/06/14現在",
  "entries": [
    {
      "rank": 1,
      "jockeyName": "Ｃ．ルメール",
      "firstPlaceCount": 84,
      "secondPlaceCount": 54,
      "thirdPlaceCount": 42,
      "outOfFrameCount": 114,
      "gradedRuns": 33,
      "gradedWins": 9,
      "specialRuns": 82,
      "specialWins": 20,
      "ordinaryRuns": 179,
      "ordinaryWins": 55,
      "turfRuns": 167,
      "turfWins": 50,
      "dirtRuns": 127,
      "dirtWins": 34,
      "winRate": 0.286,
      "quinellaRate": 0.469,
      "showRate": 0.612
    }
  ]
}
```

主な項目の意味は次の通りです。

| 項目                                                                           | 内容                                                       |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `dataAsOf`                                                                     | データ基準日です。更新した日付を `YYYY-MM-DD` で書きます。 |
| `source`                                                                       | データの説明です。例: `netkeiba JRA騎手リーディング`       |
| `sourceUrl`                                                                    | 取得元URLです。                                            |
| `netkeibaLabel`                                                                | netkeiba上の表示日付です。例: `2026/06/14現在`             |
| `entries`                                                                      | 騎手ごとの成績行です。                                     |
| `rank`                                                                         | リーディング順位です。                                     |
| `jockeyName`                                                                   | 騎手名です。netkeiba表記をそのまま入れます。               |
| `firstPlaceCount` / `secondPlaceCount` / `thirdPlaceCount` / `outOfFrameCount` | 1着、2着、3着、着外の回数です。                            |
| `gradedRuns` / `gradedWins`                                                    | 重賞の騎乗数と勝利数です。                                 |
| `specialRuns` / `specialWins`                                                  | 特別戦の騎乗数と勝利数です。                               |
| `ordinaryRuns` / `ordinaryWins`                                                | 平場の騎乗数と勝利数です。                                 |
| `turfRuns` / `turfWins`                                                        | 芝の騎乗数と勝利数です。                                   |
| `dirtRuns` / `dirtWins`                                                        | ダートの騎乗数と勝利数です。                               |
| `winRate`                                                                      | 勝率です。`28.6%` は `0.286` と書きます。                  |
| `quinellaRate`                                                                 | 連対率です。`46.9%` は `0.469` と書きます。                |
| `showRate`                                                                     | 複勝率です。`61.2%` は `0.612` と書きます。                |

`jockeyName` はレースデータ内の騎手名と完全一致しない場合があります。アプリ側では全角/半角、空白、外国人騎手のイニシャル表記などをある程度正規化して照合しますが、曖昧な一致や複数候補になる場合は照合できなかった騎手として扱います。

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
pnpm keiba:cli predict "<race-url>" --model <model> --policy-dir policies
pnpm keiba:cli analyze <race-id> --runs-dir runs
pnpm keiba:cli ask <race-id> "<question>" --model <model>
```

レースURL、レースID、レースJSONのパスは、基本的にコマンド直後の引数として指定します。既存の実行方法との互換性のため、`collect` / `predict` では `--race-url <url>`、`analyze` / `ask` / `qa-history` では `--race-id <race-id>`、`import-race` では `--race-json <path>` でも同じ値を指定できます。

`--model <model>` は、Codex SDKに渡すモデル名です。省略した場合は、Codex CLI / SDK 側の既定モデルを使用します。

`--policy-dir <path>` は、予想方針 `.md` ファイルを読み込むディレクトリです。省略した場合は `policies/` を使用します。
