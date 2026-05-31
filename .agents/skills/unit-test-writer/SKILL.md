---
name: unit-test-writer
description: "Vitest のユニットテストを実装・修正・整形するスキル。root の Vitest を前提に、`pnpm test` で全体実行できるテストを書く。AAA パターン（`// Arrange` / `// Act` / `// Assert` コメント必須）で記述し、`it` ではなく `test` を使い、テスト名は日本語で書く。テストファイルは実装ファイルと同じディレクトリに `{実装ファイル名}.test.[ts,tsx]` 形式で配置する。"
---

# Unit Test Writer

## 目的

Vitest のユニットテストを追加・修正する際に使う。root の `vitest` を全workspace共通のテストランナーとして扱い、テストは `pnpm test` で実行できる状態にする。

## 実行フロー

1. 対象コード、既存テスト、関連 fixture を確認する。
2. テストファイルを実装ファイルと同じディレクトリに `{実装ファイル名}.test.[ts,tsx]` 形式で作る。
3. 既存の import、期待値、fixture の置き方に合わせる。
4. 正常系、境界値、異常系の候補を整理し、必要な観点だけを実装する。
5. `test()` で日本語のテスト名を付ける。
6. 各テストを `// Arrange`、`// Act`、`// Assert` の順で分ける。
7. 変更対象のテストを実行し、最後に `pnpm test`、`pnpm lint`、`pnpm typecheck` を実行する。

## 必須ルール

- `it()` は使わず、必ず `test()` を使う。
- テスト名は日本語で書く。
- テストファイルは実装ファイルと同じディレクトリに置く。
- テストファイル名は `{実装ファイル名}.test.ts` または `{実装ファイル名}.test.tsx` にする。
- `.ts` / `.tsx` は実装ファイルの拡張子に合わせる。
- 各テストに `// Arrange`、`// Act`、`// Assert` コメントをこの順で入れる。
- AAA の各ブロックの間には空行を入れる。
- 1テストで確認する責務を絞る。同じ振る舞いに対する複数 assertion は許容する。
- モックは最小限にし、実装詳細ではなく公開された振る舞いを検証する。
- テスト内の helper 関数も原則として `function` 宣言ではなく `const` のarrow functionで書く。
- workspace package の import は `@keiba-ai-assistant/...` を使う。
- repository 全体で共有する fixture は `fixtures/` 配下に置き、`@fixtures/...` で import する。
- fixture は実データ由来の情報を含めない。

## 基本テンプレート

```ts
import { describe, expect, test } from "vitest";
import { targetFunction } from "@keiba-ai-assistant/package/module";

describe("targetFunction", () => {
  test("期待する振る舞きを返す", () => {
    // Arrange
    const input = "example";

    // Act
    const actual = targetFunction(input);

    // Assert
    expect(actual).toBe("expected");
  });
});
```

## 非同期テスト

- `async` / `await` を使い、`Act` を明示する。
- 失敗系は `await expect(promise).rejects...` を優先する。
- タイマーや日時依存がある場合は `vi.useFakeTimers()` などで安定化する。

## 完了前チェック

- `test()` を使っている。
- テスト名が日本語になっている。
- すべてのテストに `// Arrange` / `// Act` / `// Assert` コメントがある。
- 変更対象のテストを実行した。
- `pnpm test`、`pnpm lint`、`pnpm typecheck` を実行した。
