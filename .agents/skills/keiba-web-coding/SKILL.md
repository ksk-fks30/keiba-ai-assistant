---
name: keiba-web-coding
description: "keiba-ai-assistant の `apps/web` を Hono + Inertia.js + React で実装・修正・レビューするスキル。Route / UseCase / Repository 分離を基準に、保存済み runs JSON を repository で `packages/models` の domain model に変換し、Web 画面では一覧、詳細、分析結果、Q&A をサーバー駆動SPAとして扱う時に使う。"
---

# Keiba Web Coding

## 目的

`apps/web` の Web UI 実装では、Hono の server route と Inertia の React page を薄く保ち、処理を Route / UseCase / Repository に分ける。
DB は使わない。Repository は `runs/` 配下の JSON や `packages/storage` の読み込み結果を `packages/models` の domain model として返す責務を持つ。

## 作業前提

- 常に日本語で応答する。
- `.serena` があるため、コード参照と修正は Serena MCP Server を優先する。
- 編集前に対象ファイルを読み直す。
- 内部 import は `@keiba-ai-assistant/...` を使い、相対 import は使わない。
- 関数定義は原則として `const` の arrow function で書く。
- UIスタイリングは Tailwind CSS v4 を使い、`apps/web/src/styles/app.css` を入口にする。
- React Compiler が有効なため、描画最適化だけを目的に `useMemo`、`useCallback`、`React.memo` を追加しない。
- 実装完了時は `pnpm test`、`pnpm lint`、`pnpm typecheck` を実行する。

## 参照パターン

まず次を確認する。

- Hono app: `apps/web/src/server/app.ts`
- root HTML: `apps/web/src/server/root.tsx`
- server routes: `apps/web/src/server/routes/*.ts`
- Inertia pages: `apps/web/src/pages/**/*.tsx`
- UI components: `apps/web/src/components/**/*.tsx`
- styles: `apps/web/src/styles/app.css`
- storage API: `packages/storage/src/run-store.ts`、`packages/storage/src/qa-store.ts`
- domain models: `packages/models/src/*.ts`

## レイヤ責務

### Route

- Hono route は薄く保つ。
- UseCase は route 生成時の依存としてDIで受け取る。
- やることは「入力を受ける」「UseCase を呼ぶ」「Inertia page props や redirect を返す」に寄せる。
- route 内に JSON 読み込み、domain parse、表示用 props の組み立てを直書きしない。
- route handler 内で UseCase や Repository を生成しない。
- 画面表示は `c.render(page, props)` を使い、API 専用エンドポイントを不要に増やさない。

### UseCase

- Repository を組み合わせて画面や操作に必要な業務ロジックを実行する。
- Repository は usecase 生成時の依存としてDIで受け取る。
- run の存在確認、race / prediction / Q&A の組み合わせ、分析や追加質問の実行順制御をここに置く。
- Inertia page props として route に渡せる返却値を組み立てる。
- Inertia page props には `packages/models` の domain model を渡し、表示ラベルやメトリクス配列などのUI整形は持ち込まない。
- Hono の `Context` やファイルパス詳細は持ち込まない。
- usecase 実行中に Repository を生成しない。
- 依存オブジェクトの型は `type` / `interface` に切り出す。

### Repository

- DB は使わない。
- `runs/` 配下の JSON / JSONL、または `packages/storage` の公開APIからデータを読み込む。
- 返却値は `packages/models` の `Race`、`Prediction`、`QaEntry` などの domain model にする。
- 生 JSON、Inertia props、React 表示用 shape は返さない。
- JSON を直接読む必要がある場合は、必ず `packages/models` の `parse*` 関数で検証してから返す。

### Page / Component

- Page は Inertia props として受け取った domain model を表示用データへ加工し、画面構成を接続する。
- UI の細部は `components/` に分ける。
- 表示用データへの加工が多い場合は、React側のhookやhelperに分離する。
- `use-` で始まるファイル名や `useXxx` という関数名は、React Hook ルールに従う実際の Hook に限って使う。純粋な表示用データ変換は `xxx-view.ts` や `createXxxView` のように命名する。
- 長時間操作やフォーム送信は、ユーザーが処理状態を理解できる文言と状態を持つ。
- 操作説明のためだけの大きなテキストやランディングページ風の装飾は避け、保存済み run を確認・質問する実用画面を優先する。

## 実装順

1. 必要な domain model と storage API が既にあるか確認する。
2. Repository を作り、保存済み JSON を domain model として取得できるようにする。
3. Repository を依存として受け取る UseCase factory を作り、画面や操作に必要なdomain model取得と処理順をまとめる。
4. UseCase を依存として受け取る Route factory を薄く実装して、UseCase の返却値を Inertia page props として渡す。
5. Page / Component を実装し、React側でdomain modelを表示用データへ加工する。
6. Repository / UseCase / Route / Component のうち、変更リスクに応じてテストを書く。

## 実装ルール

- `apps/web` 内に外部公開前提の認証、マルチユーザー、DB 接続、デプロイ設定を追加しない。
- `packages/*` から `apps/web` へ依存させない。
- Repository は `packages/storage` と `packages/models` に依存してよい。
- Page props は明示的に型定義する。
- server側のRoute / UseCase / Repositoryは表示用ラベルやCSS都合のview modelを作らない。
- Promiseを返す処理は、Reactのイベントハンドラでも原則 `async` / `await` で扱う。`pending.catch(() => {})` やコメントだけの `catch` で握りつぶさない。
- `useEffect`、timer、abort handlerなど呼び出し元がPromiseを待たない場所では、呼び出すasync関数の内部で `try` / `catch` し、エラーを画面状態、ログ、進捗表示などに必ず反映する。
- コメントは日本語で、処理順、設計意図、副作用、外部I/O、保存済みファイルの扱いが誤解されやすい箇所に置く。

## テスト方針

- Repository: JSON / JSONL から domain model として読めることを確認する。
- UseCase: race / prediction / Q&A の組み合わせ、欠損時の扱い、分析や質問の実行順、Inertia props の shape を確認する。
- Route: Hono の request / response と page props の接続を確認する。
- Component / Hook: props や domain model に対する主要表示、表示用データ変換、フォーム状態を確認する。

## 完了前チェック

- Route にファイル読み込みや props 組み立てが漏れていない。
- Repository が生 JSON ではなく domain model を返している。
- server側に表示用データ変換が漏れていない。
- `pnpm test`、`pnpm lint`、`pnpm typecheck` を実行した。
