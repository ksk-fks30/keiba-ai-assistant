import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { HorseMemo } from "@keiba-ai-assistant/models";
import {
  deleteHorseMemo,
  initializeHorseMemoDatabase,
  listHorseMemos,
  writeHorseMemo,
  writeHorseMemoMark,
  writeHorseMemoNote,
  type HorseMemoStoreOptions
} from "@keiba-ai-assistant/storage/horse-memo-store";

const tempRootDirs: string[] = [];
type LegacySqliteBindValue = string | number;

interface LegacySqliteStatement {
  /** SQLを実行する。 */
  run: (...params: LegacySqliteBindValue[]) => void;
}

interface LegacySqliteDatabase {
  /** 複数SQL文をまとめて実行する。 */
  exec: (source: string) => void;
  /** SQL statementを準備する。 */
  prepare: (source: string) => LegacySqliteStatement;
  /** DB接続を閉じる。 */
  close: () => void;
}

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3") as new (path: string) => LegacySqliteDatabase;

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

  test("手動印だけを持つ既存DBをテキストメモ対応schemaへmigrationできる", async () => {
    // Arrange
    const options = await createTempHorseMemoStoreOptions();
    await createLegacyHorseMemoDatabase(options.dbPath);

    // Act
    await initializeHorseMemoDatabase(options);
    const actual = await listHorseMemos("fixture-aoba-mile-2026", options);
    const migratedMemo = actual[0];
    if (migratedMemo === undefined) {
      throw new Error("migration後の出走馬メモが取得できませんでした");
    }
    const textOnlyMemo = await writeHorseMemo(
      {
        ...migratedMemo,
        mark: null,
        note: "返し馬を確認する",
        updatedAt: "2026-06-07T13:00:00.000Z"
      },
      options
    );

    // Assert
    expect(actual).toEqual([
      createHorseMemo({
        horseId: "fixture-horse-001",
        mark: "◎",
        note: ""
      })
    ]);
    expect(textOnlyMemo.mark).toBeNull();
    expect(textOnlyMemo.note).toBe("返し馬を確認する");
  });
});

describe("writeHorseMemo", () => {
  test("出走馬メモを保存してrace IDごとに取得できる", async () => {
    // Arrange
    const options = await createTempHorseMemoStoreOptions();
    const memo = createHorseMemo({
      horseId: "fixture-horse-001",
      mark: "◎",
      note: "内枠なら買う"
    });
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
      note: "先行できれば本命",
      createdAt: "2026-06-07T12:00:00.000Z",
      updatedAt: "2026-06-07T12:00:00.000Z"
    });
    const second = createHorseMemo({
      horseId: "fixture-horse-001",
      mark: "△",
      note: "外差しなら評価を上げる",
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

  test("手動印なしのテキストメモを保存できる", async () => {
    // Arrange
    const options = await createTempHorseMemoStoreOptions();
    const memo = createHorseMemo({
      horseId: "fixture-horse-001",
      mark: null,
      note: "馬場が渋れば相手候補"
    });

    // Act
    const saved = await writeHorseMemo(memo, options);
    const actual = await listHorseMemos(memo.raceId, options);

    // Assert
    expect(saved).toEqual(memo);
    expect(actual).toEqual([memo]);
  });
});

describe("writeHorseMemoMark", () => {
  test("手動印だけを更新して既存テキストメモを維持する", async () => {
    // Arrange
    const options = await createTempHorseMemoStoreOptions();
    const memo = createHorseMemo({
      horseId: "fixture-horse-001",
      mark: "◎",
      note: "直線の伸びを確認する",
      createdAt: "2026-06-07T12:00:00.000Z",
      updatedAt: "2026-06-07T12:00:00.000Z"
    });
    await writeHorseMemo(memo, options);

    // Act
    const saved = await writeHorseMemoMark(
      {
        raceId: memo.raceId,
        horseId: memo.horseId,
        mark: "△",
        createdAt: "2026-06-07T13:00:00.000Z",
        updatedAt: "2026-06-07T13:00:00.000Z"
      },
      options
    );
    const actual = await listHorseMemos(memo.raceId, options);

    // Assert
    expect(saved).toEqual({
      ...memo,
      mark: "△",
      updatedAt: "2026-06-07T13:00:00.000Z"
    });
    expect(actual).toEqual([saved]);
  });

  test("手動印を消しても既存テキストメモがあれば行を残す", async () => {
    // Arrange
    const options = await createTempHorseMemoStoreOptions();
    const memo = createHorseMemo({
      horseId: "fixture-horse-001",
      mark: "◎",
      note: "当日の気配だけ確認する"
    });
    await writeHorseMemo(memo, options);

    // Act
    const saved = await writeHorseMemoMark(
      {
        raceId: memo.raceId,
        horseId: memo.horseId,
        mark: null,
        createdAt: "2026-06-07T13:00:00.000Z",
        updatedAt: "2026-06-07T13:00:00.000Z"
      },
      options
    );
    const actual = await listHorseMemos(memo.raceId, options);

    // Assert
    expect(saved).toEqual({
      ...memo,
      mark: null,
      updatedAt: "2026-06-07T13:00:00.000Z"
    });
    expect(actual).toEqual([saved]);
  });
});

describe("writeHorseMemoNote", () => {
  test("テキストメモだけを更新して既存手動印を維持する", async () => {
    // Arrange
    const options = await createTempHorseMemoStoreOptions();
    const memo = createHorseMemo({
      horseId: "fixture-horse-001",
      mark: "◎",
      note: "先行力を評価する",
      createdAt: "2026-06-07T12:00:00.000Z",
      updatedAt: "2026-06-07T12:00:00.000Z"
    });
    await writeHorseMemo(memo, options);

    // Act
    const saved = await writeHorseMemoNote(
      {
        raceId: memo.raceId,
        horseId: memo.horseId,
        note: "馬場が渋れば評価を上げる",
        createdAt: "2026-06-07T13:00:00.000Z",
        updatedAt: "2026-06-07T13:00:00.000Z"
      },
      options
    );
    const actual = await listHorseMemos(memo.raceId, options);

    // Assert
    expect(saved).toEqual({
      ...memo,
      note: "馬場が渋れば評価を上げる",
      updatedAt: "2026-06-07T13:00:00.000Z"
    });
    expect(actual).toEqual([saved]);
  });

  test("テキストメモを消しても既存手動印があれば行を残す", async () => {
    // Arrange
    const options = await createTempHorseMemoStoreOptions();
    const memo = createHorseMemo({
      horseId: "fixture-horse-001",
      mark: "☆",
      note: "相手候補"
    });
    await writeHorseMemo(memo, options);

    // Act
    const saved = await writeHorseMemoNote(
      {
        raceId: memo.raceId,
        horseId: memo.horseId,
        note: "",
        createdAt: "2026-06-07T13:00:00.000Z",
        updatedAt: "2026-06-07T13:00:00.000Z"
      },
      options
    );
    const actual = await listHorseMemos(memo.raceId, options);

    // Assert
    expect(saved).toEqual({
      ...memo,
      note: "",
      updatedAt: "2026-06-07T13:00:00.000Z"
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

const createLegacyHorseMemoDatabase = async (dbPath: string): Promise<void> => {
  await mkdir(dirname(dbPath), { recursive: true });
  const database = new Database(dbPath);
  try {
    database.exec(`
      CREATE TABLE horse_memo_schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE horse_memos (
        race_id TEXT NOT NULL,
        horse_id TEXT NOT NULL,
        mark TEXT NOT NULL CHECK (mark IN ('◎', '◯', '▲', '△', '☆', '✓', '✗')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (race_id, horse_id)
      );

      CREATE INDEX horse_memos_race_id_idx ON horse_memos (race_id);
    `);
    database
      .prepare("INSERT INTO horse_memo_schema_migrations (version, applied_at) VALUES (?, ?)")
      .run(1, "2026-06-07T12:00:00.000Z");
    database
      .prepare(
        `
          INSERT INTO horse_memos (
            race_id,
            horse_id,
            mark,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(
        "fixture-aoba-mile-2026",
        "fixture-horse-001",
        "◎",
        "2026-06-07T12:00:00.000Z",
        "2026-06-07T12:00:00.000Z"
      );
  } finally {
    database.close();
  }
};

const createHorseMemo = (overrides: Partial<HorseMemo> = {}): HorseMemo => {
  return {
    raceId: "fixture-aoba-mile-2026",
    horseId: "fixture-horse-001",
    mark: "◯",
    note: "",
    createdAt: "2026-06-07T12:00:00.000Z",
    updatedAt: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
};
