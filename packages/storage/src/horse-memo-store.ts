import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { parseHorseMemo, type HorseMemo, type HorseMemoMark } from "@keiba-ai-assistant/models";
import { getWorkspacePath } from "@keiba-ai-assistant/storage/workspace-root";

type SqliteBindValue = string | number | null;
type SqliteBindParameters = SqliteBindValue | Record<string, SqliteBindValue>;

interface SqliteRunResult {
  /** 更新された行数。 */
  changes: number;
}

interface SqliteStatement<Result = unknown> {
  /** SQLを実行し、更新件数などを返す。 */
  run: (...params: SqliteBindParameters[]) => SqliteRunResult;
  /** SQLを実行し、最初の1件を返す。 */
  get: (...params: SqliteBindParameters[]) => Result | undefined;
  /** SQLを実行し、結果行をすべて返す。 */
  all: (...params: SqliteBindParameters[]) => Result[];
}

interface SqliteDatabase {
  /** 複数SQL文をまとめて実行する。 */
  exec: (source: string) => void;
  /** SQLite pragmaを実行する。 */
  pragma: (source: string) => unknown;
  /** SQL statementを準備する。 */
  prepare: <Result = unknown>(source: string) => SqliteStatement<Result>;
  /** 同期処理をtransaction化する。 */
  transaction: <Result>(action: () => Result) => () => Result;
  /** DB接続を閉じる。 */
  close: () => void;
}

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3") as new (path: string) => SqliteDatabase;

export interface HorseMemoStoreOptions {
  /** SQLite DBファイルのパス。未指定時はリポジトリルートの `data/keiba.sqlite` を使用する。 */
  dbPath?: string;
}

/** 出走馬メモの印だけを保存する入力。 */
export interface WriteHorseMemoMarkInput {
  /** URLパラメータで指定されたrace ID。 */
  raceId: string;
  /** 印を保存する馬ID。 */
  horseId: string;
  /** 保存する手動印。未選択の場合はnull。 */
  mark: HorseMemoMark | null;
  /** 新規行を作る場合の作成日時。 */
  createdAt: string;
  /** 更新日時。 */
  updatedAt: string;
}

/** 出走馬メモの本文だけを保存する入力。 */
export interface WriteHorseMemoNoteInput {
  /** URLパラメータで指定されたrace ID。 */
  raceId: string;
  /** メモ本文を保存する馬ID。 */
  horseId: string;
  /** 保存するテキストメモ。空文字の場合は本文なしとして扱う。 */
  note: string;
  /** 新規行を作る場合の作成日時。 */
  createdAt: string;
  /** 更新日時。 */
  updatedAt: string;
}

interface SchemaMigration {
  /** migrationを一意に識別する連番。 */
  version: number;
  /** 適用するSQL。 */
  sql: string;
}

interface MigrationRow {
  /** 適用済みmigrationのversion。 */
  version: number;
}

interface HorseMemoRow {
  race_id: string;
  horse_id: string;
  mark: HorseMemoMark | null;
  note: string;
  created_at: string;
  updated_at: string;
}

const defaultDatabasePath = "data/keiba.sqlite" as const;

const migrations: SchemaMigration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS horse_memos (
        race_id TEXT NOT NULL,
        horse_id TEXT NOT NULL,
        mark TEXT NOT NULL CHECK (mark IN ('◎', '◯', '▲', '△', '☆', '✓', '✗')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (race_id, horse_id)
      );

      CREATE INDEX IF NOT EXISTS horse_memos_race_id_idx ON horse_memos (race_id);
    `
  },
  {
    version: 2,
    sql: `
      CREATE TABLE horse_memos_next (
        race_id TEXT NOT NULL,
        horse_id TEXT NOT NULL,
        mark TEXT CHECK (mark IS NULL OR mark IN ('◎', '◯', '▲', '△', '☆', '✓', '✗')),
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (race_id, horse_id)
      );

      INSERT INTO horse_memos_next (
        race_id,
        horse_id,
        mark,
        note,
        created_at,
        updated_at
      )
      SELECT
        race_id,
        horse_id,
        mark,
        '',
        created_at,
        updated_at
      FROM horse_memos;

      DROP TABLE horse_memos;
      ALTER TABLE horse_memos_next RENAME TO horse_memos;
      CREATE INDEX IF NOT EXISTS horse_memos_race_id_idx ON horse_memos (race_id);
    `
  }
];

/** WebメモDBの既定パスを返す。 */
export const getDefaultHorseMemoDatabasePath = (): string => {
  return getWorkspacePath(defaultDatabasePath);
};

/** Webメモ用のSQLite DBを作成し、migrationを適用する。 */
export const initializeHorseMemoDatabase = async (
  options: HorseMemoStoreOptions = {}
): Promise<void> => {
  withDatabase(options, () => undefined);
};

/** 指定race IDに保存された出走馬メモを返す。 */
export const listHorseMemos = async (
  raceId: string,
  options: HorseMemoStoreOptions = {}
): Promise<HorseMemo[]> => {
  return withDatabase(options, (database) => {
    const rows = database
      .prepare<HorseMemoRow>(
        `
          SELECT * FROM horse_memos
          WHERE race_id = ?
          ORDER BY horse_id ASC
        `
      )
      .all(raceId);

    return rows.map(rowToHorseMemo);
  });
};

/** 出走馬メモを保存する。同じrace IDと馬IDの既存メモは更新する。 */
export const writeHorseMemo = async (
  memo: HorseMemo,
  options: HorseMemoStoreOptions = {}
): Promise<HorseMemo> => {
  const parsedMemo = parseHorseMemo(memo);

  return withDatabase(options, (database) => {
    const existing = database
      .prepare<Pick<HorseMemoRow, "created_at">>(
        `
          SELECT created_at FROM horse_memos
          WHERE race_id = ? AND horse_id = ?
        `
      )
      .get(parsedMemo.raceId, parsedMemo.horseId);
    const createdAt = existing?.created_at ?? parsedMemo.createdAt;

    database
      .prepare(
        `
          INSERT INTO horse_memos (
            race_id,
            horse_id,
            mark,
            note,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(race_id, horse_id) DO UPDATE SET
            mark = excluded.mark,
            note = excluded.note,
            updated_at = excluded.updated_at
        `
      )
      .run(
        parsedMemo.raceId,
        parsedMemo.horseId,
        parsedMemo.mark,
        parsedMemo.note,
        createdAt,
        parsedMemo.updatedAt
      );

    const stored = database
      .prepare<HorseMemoRow>(
        `
          SELECT * FROM horse_memos
          WHERE race_id = ? AND horse_id = ?
        `
      )
      .get(parsedMemo.raceId, parsedMemo.horseId);
    if (stored === undefined) {
      throw new Error(
        `出走馬メモを保存できませんでした: ${parsedMemo.raceId}/${parsedMemo.horseId}`
      );
    }

    return rowToHorseMemo(stored);
  });
};

/** 出走馬メモの手動印だけを保存する。既存のテキストメモは維持する。 */
export const writeHorseMemoMark = async (
  input: WriteHorseMemoMarkInput,
  options: HorseMemoStoreOptions = {}
): Promise<HorseMemo | null> => {
  return withDatabase(options, (database) => {
    const existing = findHorseMemoRow(database, input.raceId, input.horseId);
    if (input.mark === null && (existing === undefined || existing.note.length === 0)) {
      deleteHorseMemoRow(database, input.raceId, input.horseId);
      return null;
    }

    if (existing === undefined) {
      database
        .prepare(
          `
            INSERT INTO horse_memos (
              race_id,
              horse_id,
              mark,
              note,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
          `
        )
        .run(input.raceId, input.horseId, input.mark, "", input.createdAt, input.updatedAt);
    } else {
      database
        .prepare(
          `
            UPDATE horse_memos
            SET mark = ?, updated_at = ?
            WHERE race_id = ? AND horse_id = ?
          `
        )
        .run(input.mark, input.updatedAt, input.raceId, input.horseId);
    }

    const stored = findHorseMemoRow(database, input.raceId, input.horseId);
    if (stored === undefined) {
      throw new Error(`出走馬メモを保存できませんでした: ${input.raceId}/${input.horseId}`);
    }

    return rowToHorseMemo(stored);
  });
};

/** 出走馬メモのテキスト本文だけを保存する。既存の手動印は維持する。 */
export const writeHorseMemoNote = async (
  input: WriteHorseMemoNoteInput,
  options: HorseMemoStoreOptions = {}
): Promise<HorseMemo | null> => {
  return withDatabase(options, (database) => {
    const existing = findHorseMemoRow(database, input.raceId, input.horseId);
    if (input.note.length === 0 && (existing === undefined || existing.mark === null)) {
      deleteHorseMemoRow(database, input.raceId, input.horseId);
      return null;
    }

    if (existing === undefined) {
      database
        .prepare(
          `
            INSERT INTO horse_memos (
              race_id,
              horse_id,
              mark,
              note,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
          `
        )
        .run(input.raceId, input.horseId, null, input.note, input.createdAt, input.updatedAt);
    } else {
      database
        .prepare(
          `
            UPDATE horse_memos
            SET note = ?, updated_at = ?
            WHERE race_id = ? AND horse_id = ?
          `
        )
        .run(input.note, input.updatedAt, input.raceId, input.horseId);
    }

    const stored = findHorseMemoRow(database, input.raceId, input.horseId);
    if (stored === undefined) {
      throw new Error(`出走馬メモを保存できませんでした: ${input.raceId}/${input.horseId}`);
    }

    return rowToHorseMemo(stored);
  });
};

/** 指定race IDと馬IDの出走馬メモを削除する。 */
export const deleteHorseMemo = async (
  raceId: string,
  horseId: string,
  options: HorseMemoStoreOptions = {}
): Promise<void> => {
  withDatabase(options, (database) => {
    deleteHorseMemoRow(database, raceId, horseId);
  });
};

const findHorseMemoRow = (
  database: SqliteDatabase,
  raceId: string,
  horseId: string
): HorseMemoRow | undefined => {
  return database
    .prepare<HorseMemoRow>(
      `
        SELECT * FROM horse_memos
        WHERE race_id = ? AND horse_id = ?
      `
    )
    .get(raceId, horseId);
};

const deleteHorseMemoRow = (database: SqliteDatabase, raceId: string, horseId: string): void => {
  database
    .prepare("DELETE FROM horse_memos WHERE race_id = ? AND horse_id = ?")
    .run(raceId, horseId);
};

const withDatabase = <Result>(
  options: HorseMemoStoreOptions,
  action: (database: SqliteDatabase) => Result
): Result => {
  const dbPath = options.dbPath ?? getDefaultHorseMemoDatabasePath();
  mkdirSync(dirname(dbPath), { recursive: true });
  const database = new Database(dbPath);
  try {
    database.pragma("foreign_keys = ON");
    database.pragma("journal_mode = WAL");
    runMigrations(database);
    return action(database);
  } finally {
    database.close();
  }
};

const runMigrations = (database: SqliteDatabase): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS horse_memo_schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedVersions = new Set(
    database
      .prepare<MigrationRow>("SELECT version FROM horse_memo_schema_migrations")
      .all()
      .map((row) => row.version)
  );

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    const applyMigration = database.transaction(() => {
      database.exec(migration.sql);
      database
        .prepare("INSERT INTO horse_memo_schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(migration.version, new Date().toISOString());
    });
    applyMigration();
  }
};

const rowToHorseMemo = (row: HorseMemoRow): HorseMemo => {
  return parseHorseMemo({
    raceId: row.race_id,
    horseId: row.horse_id,
    mark: row.mark,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
};
