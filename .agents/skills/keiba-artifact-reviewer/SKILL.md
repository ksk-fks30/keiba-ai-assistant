---
name: keiba-artifact-reviewer
description: "keiba-ai-assistant の生成成果物を精査するスキル。ユーザーが runs 配下の prediction.json、qa.jsonl、qa-history 出力、CLI 実行後の成果物について「見て」「精査して」「どう？」と依頼したときに使う。モデル parse、JSON 構造、Q&A 履歴、AI 回答の妥当性、方針逸脱、二重 JSON 文字列、生成物としての改善点を確認する。"
---

# Keiba Artifact Reviewer

## 目的

`runs/{raceId}` 配下に生成されたレース分析と Q&A 履歴を、実装不具合と出力品質の両面から精査する。ユーザーが再実行後の成果物確認を求めた場合は、ファイル編集せずに結果だけを報告する。

## 実行フロー

1. 対象 race ID と `runs` ディレクトリを特定する。ユーザーが明示していない場合は、直近の会話や `runs/` 配下から自然に判断できる範囲で確認する。
2. `runs/{raceId}/prediction.json` があれば、モデルとして parse できるか確認する。
3. `runs/{raceId}/qa.jsonl` があれば、行数、各 entry の `id`、`raceId`、`question`、`answer`、`createdAt` を確認する。
4. `qa-history` コマンドが使える状態なら表示結果も確認し、raw データと表示結果の差分を見る。
5. 予想や回答が保存済みの race data、prediction、policy、過去 Q&A から逸脱していないか確認する。
6. 結果は「問題」「改善候補」「問題なし」を分けて、短く具体的に報告する。

## 確認観点

- JSON と JSONL が壊れていない。
- `prediction.json` が `Prediction` モデルとして parse できる。
- `qa.jsonl` の各行が `QaEntry` モデルとして parse できる。
- `answer` が `{"answer":"..."}` のような二重 JSON 文字列になっていない。
- 旧成果物が二重 JSON 文字列の場合、読み込み・表示時に正規化されている。
- `id` が `qa-0001-...` のように連番と timestamp を含む形で増えている。
- `createdAt` がアプリ側で付与された ISO 文字列になっている。
- 同一質問の再実行で、履歴の扱いが不自然でない。
- AI の回答が根拠データにない断定や、ユーザー方針に反する提案をしていない。
- CLI の表示がユーザーに読める自然な日本語になっている。

## 推奨コマンド

対象 race ID が `fixture-aoba-mile-2026` の場合:

```bash
pnpm --filter @keiba-ai-assistant/cli exec tsx src/index.ts qa-history --race-id fixture-aoba-mile-2026 --runs-dir ./runs
```

JSON / JSONL の構造確認は、既存コードの `readQaEntries` や `parsePrediction` など公開 API を使えるならそれを優先する。単なる目視で足りる場合は `wc`、`sed`、`jq` などで最小限に確認する。

## 報告方針

- ファイル編集はしない。ユーザーが修正を求めた場合だけ、別作業として編集する。
- raw ファイル上の問題と、アプリ表示上の問題を分けて報告する。
- 生成物が `.gitignore` 対象の場合、履歴データの一回限りの汚れを過剰に扱わない。
- 実装不具合の可能性がある場合は、どのファイル・どのフィールド・どのコマンドで再現したかを明示する。
- 出力品質の改善案は、すぐ必要な修正と将来の改善候補を分ける。
