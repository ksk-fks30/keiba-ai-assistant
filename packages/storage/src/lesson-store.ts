import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import {
  parseLessonEntry,
  parsePredictionLessonReference,
  type LessonEntry,
  type LessonStatus,
  type PredictionLessonReference
} from "@keiba-ai-assistant/models";
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

export interface LessonStoreOptions {
  /** SQLite DBファイルのパス。未指定時はリポジトリルートの `data/keiba.sqlite` を使用する。 */
  dbPath?: string;
}

/** Lesson検索時の条件。 */
export interface LessonSearchInput {
  /** FTS5で検索する自然文クエリ。 */
  query?: string | undefined;
  /** 短い競馬キーワードのタグ検索条件。 */
  tags?: string[] | undefined;
  /** 取得する最大件数。未指定時は10件。 */
  limit?: number | undefined;
  /** 検索対象のLesson状態。未指定時は `approved` のみ。 */
  status?: LessonStatus | undefined;
}

/** Lesson一覧取得時の条件。 */
export interface ListLessonEntriesInput {
  /** 一覧対象のLesson状態。未指定時は全状態を返す。 */
  status?: LessonStatus | undefined;
  /** 取得する最大件数。未指定時は50件。 */
  limit?: number | undefined;
}

/** Lesson検索で返すスコア付き結果。 */
export interface LessonSearchResult {
  /** 検索に一致したLesson。 */
  lesson: LessonEntry;
  /** アプリ側で候補順を決めるための合成スコア。 */
  score: number;
  /** 検索条件のうち一致したタグ。 */
  matchedTags: string[];
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

interface LessonEntryRow {
  id: string;
  source_race_id: string;
  status: LessonStatus;
  title: string;
  situation_key: string;
  tags_json: string;
  diary_text: string;
  decision_guidance: string;
  applicable_when_json: string;
  not_applicable_when_json: string;
  confidence: LessonEntry["confidence"];
  created_at: string;
  updated_at: string;
}

interface LessonFtsRow extends LessonEntryRow {
  fts_rank: number;
}

interface LessonTagRow extends LessonEntryRow {
  tag_match_count: number;
}

interface PredictionLessonReferenceRow {
  race_id: string;
  prediction_id: string;
  lesson_id: string;
  reason: string;
  used_at: string;
}

interface CandidateAccumulator {
  lesson: LessonEntry;
  ftsRank?: number;
  tagMatchCount: number;
  order: number;
}

const defaultDatabasePath = "data/keiba.sqlite" as const;
const defaultSearchLimit = 10;
const defaultListLimit = 50;
const maxSearchLimit = 50;

const migrations: SchemaMigration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE lesson_entries (
        id TEXT PRIMARY KEY,
        source_race_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'archived')),
        title TEXT NOT NULL,
        situation_key TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        diary_text TEXT NOT NULL,
        decision_guidance TEXT NOT NULL,
        applicable_when_json TEXT NOT NULL,
        not_applicable_when_json TEXT NOT NULL,
        confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX lesson_entries_status_updated_at_idx
        ON lesson_entries (status, updated_at);

      CREATE TABLE lesson_tags (
        lesson_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (lesson_id, tag),
        FOREIGN KEY (lesson_id) REFERENCES lesson_entries (id) ON DELETE CASCADE
      );

      CREATE INDEX lesson_tags_tag_idx ON lesson_tags (tag);

      CREATE VIRTUAL TABLE lesson_entries_fts USING fts5(
        lesson_id UNINDEXED,
        title,
        situation_key,
        diary_text,
        decision_guidance,
        applicable_when,
        not_applicable_when,
        tokenize = 'trigram'
      );

      CREATE TABLE prediction_lesson_references (
        race_id TEXT NOT NULL,
        prediction_id TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        used_at TEXT NOT NULL,
        PRIMARY KEY (prediction_id, lesson_id),
        FOREIGN KEY (lesson_id) REFERENCES lesson_entries (id) ON DELETE CASCADE
      );

      CREATE INDEX prediction_lesson_references_race_id_idx
        ON prediction_lesson_references (race_id);
    `
  }
];

/** デフォルトのLesson DBパスを返す。 */
export const getDefaultLessonDatabasePath = (): string => {
  return getWorkspacePath(defaultDatabasePath);
};

/** SQLite DBを開き、必要なmigrationを適用できる状態にする。 */
export const initializeLessonDatabase = async (options: LessonStoreOptions = {}): Promise<void> => {
  withDatabase(options, () => undefined);
};

/** Lessonを検証し、SQLiteへ保存する。FTS5とタグの検索インデックスも同時に更新する。 */
export const saveLessonEntry = async (
  lesson: LessonEntry,
  options: LessonStoreOptions = {}
): Promise<void> => {
  const parsed = parseLessonEntry(lesson);
  withDatabase(options, (database) => {
    const save = database.transaction(() => {
      database
        .prepare(
          `
            INSERT INTO lesson_entries (
              id,
              source_race_id,
              status,
              title,
              situation_key,
              tags_json,
              diary_text,
              decision_guidance,
              applicable_when_json,
              not_applicable_when_json,
              confidence,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              source_race_id = excluded.source_race_id,
              status = excluded.status,
              title = excluded.title,
              situation_key = excluded.situation_key,
              tags_json = excluded.tags_json,
              diary_text = excluded.diary_text,
              decision_guidance = excluded.decision_guidance,
              applicable_when_json = excluded.applicable_when_json,
              not_applicable_when_json = excluded.not_applicable_when_json,
              confidence = excluded.confidence,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at
          `
        )
        .run(
          parsed.id,
          parsed.sourceRaceId,
          parsed.status,
          parsed.title,
          parsed.situationKey,
          JSON.stringify(parsed.tags),
          parsed.diaryText,
          parsed.decisionGuidance,
          JSON.stringify(parsed.applicableWhen),
          JSON.stringify(parsed.notApplicableWhen),
          parsed.confidence,
          parsed.createdAt,
          parsed.updatedAt
        );

      database.prepare("DELETE FROM lesson_tags WHERE lesson_id = ?").run(parsed.id);
      const insertTag = database.prepare("INSERT INTO lesson_tags (lesson_id, tag) VALUES (?, ?)");
      for (const tag of normalizeTags(parsed.tags)) {
        insertTag.run(parsed.id, tag);
      }

      database.prepare("DELETE FROM lesson_entries_fts WHERE lesson_id = ?").run(parsed.id);
      database
        .prepare(
          `
            INSERT INTO lesson_entries_fts (
              lesson_id,
              title,
              situation_key,
              diary_text,
              decision_guidance,
              applicable_when,
              not_applicable_when
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          parsed.id,
          parsed.title,
          parsed.situationKey,
          parsed.diaryText,
          parsed.decisionGuidance,
          parsed.applicableWhen.join("\n"),
          parsed.notApplicableWhen.join("\n")
        );
    });

    save();
  });
};

/** Lessonの状態だけを更新する。 */
export const updateLessonEntryStatus = async (
  lessonId: string,
  status: LessonStatus,
  options: LessonStoreOptions = {}
): Promise<void> => {
  withDatabase(options, (database) => {
    const result = database
      .prepare("UPDATE lesson_entries SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, new Date().toISOString(), lessonId);
    if (result.changes === 0) {
      throw new Error(`Lessonが見つかりません: ${lessonId}`);
    }
  });
};

/** 保存済みLessonを一覧取得する。 */
export const listLessonEntries = async (
  input: ListLessonEntriesInput = {},
  options: LessonStoreOptions = {}
): Promise<LessonEntry[]> => {
  return withDatabase(options, (database) => {
    const limit = normalizeLimit(input.limit, defaultListLimit);
    const rows =
      input.status === undefined
        ? database
            .prepare<LessonEntryRow>(
              `
                SELECT * FROM lesson_entries
                ORDER BY updated_at DESC, id ASC
                LIMIT ?
              `
            )
            .all(limit)
        : database
            .prepare<LessonEntryRow>(
              `
                SELECT * FROM lesson_entries
                WHERE status = ?
                ORDER BY updated_at DESC, id ASC
                LIMIT ?
              `
            )
            .all(input.status, limit);

    return rows.map(rowToLessonEntry);
  });
};

/** FTS5とタグ一致を組み合わせ、予想時に渡すLesson候補を取得する。 */
export const searchLessonEntries = async (
  input: LessonSearchInput = {},
  options: LessonStoreOptions = {}
): Promise<LessonSearchResult[]> => {
  return withDatabase(options, (database) => {
    const status = input.status ?? "approved";
    const limit = normalizeLimit(input.limit, defaultSearchLimit);
    const rowLimit = limit * 5;
    const tags = normalizeTags(input.tags ?? []);
    const ftsQuery = buildFtsQuery(input.query);
    const candidates = new Map<string, CandidateAccumulator>();
    let order = 0;

    if (ftsQuery !== null) {
      const rows = database
        .prepare<LessonFtsRow>(
          `
            SELECT
              lesson_entries.*,
              bm25(lesson_entries_fts) AS fts_rank
            FROM lesson_entries_fts
            JOIN lesson_entries
              ON lesson_entries.id = lesson_entries_fts.lesson_id
            WHERE lesson_entries_fts MATCH ?
              AND lesson_entries.status = ?
            ORDER BY fts_rank ASC
            LIMIT ?
          `
        )
        .all(ftsQuery, status, rowLimit);

      for (const row of rows) {
        addCandidate(candidates, rowToLessonEntry(row), {
          ftsRank: row.fts_rank,
          tagMatchCount: 0,
          order
        });
        order += 1;
      }
    }

    if (tags.length > 0) {
      const placeholders = tags.map(() => "?").join(", ");
      const rows = database
        .prepare<LessonTagRow>(
          `
            SELECT
              lesson_entries.*,
              COUNT(lesson_tags.tag) AS tag_match_count
            FROM lesson_entries
            JOIN lesson_tags
              ON lesson_tags.lesson_id = lesson_entries.id
            WHERE lesson_entries.status = ?
              AND lesson_tags.tag IN (${placeholders})
            GROUP BY lesson_entries.id
            ORDER BY tag_match_count DESC, lesson_entries.updated_at DESC
            LIMIT ?
          `
        )
        .all(status, ...tags, rowLimit);

      for (const row of rows) {
        addCandidate(candidates, rowToLessonEntry(row), {
          tagMatchCount: row.tag_match_count,
          order
        });
        order += 1;
      }
    }

    if (ftsQuery === null && tags.length === 0) {
      const rows = database
        .prepare<LessonEntryRow>(
          `
            SELECT * FROM lesson_entries
            WHERE status = ?
            ORDER BY updated_at DESC, id ASC
            LIMIT ?
          `
        )
        .all(status, limit);

      return rows.map((row) => ({
        lesson: rowToLessonEntry(row),
        score: 0,
        matchedTags: []
      }));
    }

    return [...candidates.values()]
      .map((candidate) => ({ result: buildSearchResult(candidate, tags), order: candidate.order }))
      .sort((left, right) => {
        if (right.result.score !== left.result.score) {
          return right.result.score - left.result.score;
        }

        return left.result.lesson.updatedAt.localeCompare(right.result.lesson.updatedAt) === 0
          ? left.order - right.order
          : right.result.lesson.updatedAt.localeCompare(left.result.lesson.updatedAt);
      })
      .slice(0, limit)
      .map((item) => item.result);
  });
};

/** 予想とLessonの参照履歴を保存する。同一predictionIdの既存履歴は置き換える。 */
export const recordPredictionLessonReferences = async (
  references: PredictionLessonReference[],
  options: LessonStoreOptions = {}
): Promise<void> => {
  const parsedReferences = references.map(parsePredictionLessonReference);
  withDatabase(options, (database) => {
    const save = database.transaction(() => {
      const predictionKeys = new Set(
        parsedReferences.map((reference) => `${reference.raceId}\n${reference.predictionId}`)
      );
      const deleteStatement = database.prepare(
        "DELETE FROM prediction_lesson_references WHERE race_id = ? AND prediction_id = ?"
      );
      for (const key of predictionKeys) {
        const [raceId, predictionId] = key.split("\n");
        if (raceId !== undefined && predictionId !== undefined) {
          deleteStatement.run(raceId, predictionId);
        }
      }

      const insertStatement = database.prepare(
        `
          INSERT INTO prediction_lesson_references (
            race_id,
            prediction_id,
            lesson_id,
            reason,
            used_at
          )
          VALUES (?, ?, ?, ?, ?)
        `
      );
      for (const reference of parsedReferences) {
        insertStatement.run(
          reference.raceId,
          reference.predictionId,
          reference.lessonId,
          reference.reason,
          reference.usedAt
        );
      }
    });

    save();
  });
};

/** 指定レースのLesson参照履歴を返す。 */
export const listPredictionLessonReferences = async (
  raceId: string,
  options: LessonStoreOptions = {}
): Promise<PredictionLessonReference[]> => {
  return withDatabase(options, (database) => {
    const rows = database
      .prepare<PredictionLessonReferenceRow>(
        `
          SELECT * FROM prediction_lesson_references
          WHERE race_id = ?
          ORDER BY used_at DESC, prediction_id DESC, lesson_id ASC
        `
      )
      .all(raceId);

    return rows.map(rowToPredictionLessonReference);
  });
};

const withDatabase = <Result>(
  options: LessonStoreOptions,
  action: (database: SqliteDatabase) => Result
): Result => {
  const dbPath = options.dbPath ?? getDefaultLessonDatabasePath();
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
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedVersions = new Set(
    database
      .prepare<MigrationRow>("SELECT version FROM schema_migrations")
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
        .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(migration.version, new Date().toISOString());
    });
    applyMigration();
  }
};

const rowToLessonEntry = (row: LessonEntryRow): LessonEntry => {
  return parseLessonEntry({
    id: row.id,
    sourceRaceId: row.source_race_id,
    status: row.status,
    title: row.title,
    situationKey: row.situation_key,
    tags: parseStringArray(row.tags_json, "tags_json"),
    diaryText: row.diary_text,
    decisionGuidance: row.decision_guidance,
    applicableWhen: parseStringArray(row.applicable_when_json, "applicable_when_json"),
    notApplicableWhen: parseStringArray(row.not_applicable_when_json, "not_applicable_when_json"),
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
};

const rowToPredictionLessonReference = (
  row: PredictionLessonReferenceRow
): PredictionLessonReference => {
  return parsePredictionLessonReference({
    raceId: row.race_id,
    predictionId: row.prediction_id,
    lessonId: row.lesson_id,
    reason: row.reason,
    usedAt: row.used_at
  });
};

const parseStringArray = (value: string, label: string): string[] => {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error(`${label} は文字列配列JSONである必要があります。`);
  }

  return parsed;
};

const normalizeTags = (tags: string[]): string[] => {
  return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))];
};

const normalizeLimit = (limit: number | undefined, defaultLimit: number): number => {
  if (limit === undefined) {
    return defaultLimit;
  }

  return Math.max(1, Math.min(maxSearchLimit, Math.floor(limit)));
};

const buildFtsQuery = (query: string | undefined): string | null => {
  if (query === undefined) {
    return null;
  }

  const terms = query
    .split(/[\s　,、]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .map((term) => `"${term.replaceAll('"', '""')}"`);

  if (terms.length === 0) {
    return null;
  }

  return terms.join(" OR ");
};

const addCandidate = (
  candidates: Map<string, CandidateAccumulator>,
  lesson: LessonEntry,
  values: {
    ftsRank?: number;
    tagMatchCount: number;
    order: number;
  }
): void => {
  const current = candidates.get(lesson.id);
  if (current === undefined) {
    const candidate: CandidateAccumulator = {
      lesson,
      tagMatchCount: values.tagMatchCount,
      order: values.order
    };
    if (values.ftsRank !== undefined) {
      candidate.ftsRank = values.ftsRank;
    }
    candidates.set(lesson.id, candidate);
    return;
  }

  if (values.ftsRank !== undefined) {
    current.ftsRank = values.ftsRank;
  }
  current.tagMatchCount += values.tagMatchCount;
};

const buildSearchResult = (
  candidate: CandidateAccumulator,
  searchTags: string[]
): LessonSearchResult => {
  const matchedTags = searchTags.filter((tag) => candidate.lesson.tags.includes(tag));
  const ftsScore = candidate.ftsRank === undefined ? 0 : 5 / (1 + Math.max(0, candidate.ftsRank));
  const tagScore = candidate.tagMatchCount * 10;
  const confidenceScore =
    candidate.lesson.confidence === "high" ? 2 : candidate.lesson.confidence === "medium" ? 1 : 0;

  return {
    lesson: candidate.lesson,
    score: tagScore + ftsScore + confidenceScore,
    matchedTags
  };
};
