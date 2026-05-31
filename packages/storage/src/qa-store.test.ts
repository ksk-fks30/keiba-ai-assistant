import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { QaEntry } from "@keiba-ai-assistant/models";
import {
  appendQaEntry,
  createRun,
  readQaEntries,
  type RunStoreOptions
} from "@keiba-ai-assistant/storage";

const tempRootDirs: string[] = [];

afterEach(async () => {
  // Arrange
  const rootDirs = tempRootDirs.splice(0);

  // Act
  await Promise.all(rootDirs.map((rootDir) => rm(rootDir, { recursive: true, force: true })));

  // Assert
  expect(tempRootDirs).toHaveLength(0);
});

describe("qa-store", () => {
  test("Q&A履歴を追記順に読み込める", async () => {
    // Arrange
    const options = await createTempRunStoreOptions();
    const firstEntry = createQaEntry("qa-fixture-001", "展開面のリスクは？");
    const secondEntry = createQaEntry("qa-fixture-002", "馬場が悪化した場合は？");

    // Act
    await appendQaEntry(firstEntry, options);
    await appendQaEntry(secondEntry, options);
    const actual = await readQaEntries(firstEntry.raceId, options);

    // Assert
    expect(actual).toEqual([firstEntry, secondEntry]);
  });

  test("存在しない Q&A 履歴は空配列として読み込める", async () => {
    // Arrange
    const options = await createTempRunStoreOptions();

    // Act
    const actual = await readQaEntries("missing-race", options);

    // Assert
    expect(actual).toEqual([]);
  });

  test("answer がJSON文字列の Q&A 履歴は本文だけに正規化して読み込める", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const options: RunStoreOptions = { rootDir };
    const raceId = "fixture-aoba-mile-2026";
    await createRun(raceId, options);
    await writeFile(
      join(rootDir, raceId, "qa.jsonl"),
      `${JSON.stringify({
        id: "qa-fixture-001",
        raceId,
        question: "買い目を変えるべき？",
        answer: JSON.stringify({ answer: "買い目を大きく変える必要はありません。" }),
        createdAt: "2026-05-31T14:10:00+09:00"
      })}\n`
    );

    // Act
    const actual = await readQaEntries(raceId, options);

    // Assert
    expect(actual[0]?.answer).toBe("買い目を大きく変える必要はありません。");
  });

  test("スキーマ不一致の Q&A 履歴は失敗として扱う", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const options: RunStoreOptions = { rootDir };
    const raceId = "fixture-aoba-mile-2026";
    await createRun(raceId, options);
    await writeFile(join(rootDir, raceId, "qa.jsonl"), `${JSON.stringify({ id: "invalid" })}\n`);

    // Act
    const actual = readQaEntries(raceId, options);

    // Assert
    await expect(actual).rejects.toThrow();
  });

  test("JSONとして読めない Q&A 履歴は失敗として扱う", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const options: RunStoreOptions = { rootDir };
    const raceId = "fixture-aoba-mile-2026";
    await createRun(raceId, options);
    await writeFile(join(rootDir, raceId, "qa.jsonl"), "not-json\n");

    // Act
    const actual = readQaEntries(raceId, options);

    // Assert
    await expect(actual).rejects.toThrow();
  });
});

const createQaEntry = (id: string, question: string): QaEntry => {
  return {
    id,
    raceId: "fixture-aoba-mile-2026",
    question,
    answer: `${question} に対するfixture回答。`,
    createdAt: "2026-05-31T14:10:00+09:00"
  };
};

const createTempRunStoreOptions = async (): Promise<RunStoreOptions> => {
  const rootDir = await createTempRootDir();
  return { rootDir };
};

const createTempRootDir = async (): Promise<string> => {
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-qa-store-"));
  tempRootDirs.push(rootDir);
  return rootDir;
};
