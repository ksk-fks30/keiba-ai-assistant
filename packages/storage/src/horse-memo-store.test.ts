import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { HorseMemo } from "@keiba-ai-assistant/models";
import {
  deleteHorseMemo,
  initializeHorseMemoDatabase,
  listHorseMemos,
  writeHorseMemo,
  type HorseMemoStoreOptions
} from "@keiba-ai-assistant/storage/horse-memo-store";

const tempRootDirs: string[] = [];

afterEach(async () => {
  // Arrange
  const rootDirs = tempRootDirs.splice(0);

  // Act
  await Promise.all(rootDirs.map((rootDir) => rm(rootDir, { recursive: true, force: true })));

  // Assert
  expect(tempRootDirs).toHaveLength(0);
});

describe("initializeHorseMemoDatabase", () => {
  test("SQLite DBを作成してWebメモ用migrationを適用できる", async () => {
    // Arrange
    const options = await createTempHorseMemoStoreOptions();

    // Act
    await initializeHorseMemoDatabase(options);
    const actual = await stat(options.dbPath);

    // Assert
    expect(actual.isFile()).toBe(true);
  });
});

describe("writeHorseMemo", () => {
  test("出走馬メモを保存してrace IDごとに取得できる", async () => {
    // Arrange
    const options = await createTempHorseMemoStoreOptions();
    const memo = createHorseMemo({ horseId: "fixture-horse-001", mark: "◎" });
    await writeHorseMemo(createHorseMemo({ raceId: "fixture-other-race" }), options);

    // Act
    const saved = await writeHorseMemo(memo, options);
    const actual = await listHorseMemos(memo.raceId, options);

    // Assert
    expect(saved).toEqual(memo);
    expect(actual).toEqual([memo]);
  });

  test("同じrace IDと馬IDのメモを更新して作成日時を維持する", async () => {
    // Arrange
    const options = await createTempHorseMemoStoreOptions();
    const first = createHorseMemo({
      horseId: "fixture-horse-001",
      mark: "◎",
      createdAt: "2026-06-07T12:00:00.000Z",
      updatedAt: "2026-06-07T12:00:00.000Z"
    });
    const second = createHorseMemo({
      horseId: "fixture-horse-001",
      mark: "△",
      createdAt: "2026-06-07T13:00:00.000Z",
      updatedAt: "2026-06-07T13:00:00.000Z"
    });
    await writeHorseMemo(first, options);

    // Act
    const saved = await writeHorseMemo(second, options);
    const actual = await listHorseMemos(first.raceId, options);

    // Assert
    expect(saved).toEqual({
      ...second,
      createdAt: first.createdAt
    });
    expect(actual).toEqual([saved]);
  });
});

describe("deleteHorseMemo", () => {
  test("指定した出走馬メモを削除できる", async () => {
    // Arrange
    const options = await createTempHorseMemoStoreOptions();
    const memo = createHorseMemo({ horseId: "fixture-horse-001", mark: "✓" });
    await writeHorseMemo(memo, options);

    // Act
    await deleteHorseMemo(memo.raceId, memo.horseId, options);
    const actual = await listHorseMemos(memo.raceId, options);

    // Assert
    expect(actual).toEqual([]);
  });
});

const createTempHorseMemoStoreOptions = async (): Promise<Required<HorseMemoStoreOptions>> => {
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-horse-memo-store-"));
  tempRootDirs.push(rootDir);
  return { dbPath: join(rootDir, "data", "keiba.sqlite") };
};

const createHorseMemo = (overrides: Partial<HorseMemo> = {}): HorseMemo => {
  return {
    raceId: "fixture-aoba-mile-2026",
    horseId: "fixture-horse-001",
    mark: "◯",
    createdAt: "2026-06-07T12:00:00.000Z",
    updatedAt: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
};
