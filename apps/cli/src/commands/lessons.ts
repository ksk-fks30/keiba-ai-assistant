import type { Command } from "commander";
import {
  lessonStatusSchema,
  type LessonEntry,
  type LessonStatus
} from "@keiba-ai-assistant/models";
import {
  listLessonEntries,
  searchLessonEntries,
  updateLessonEntryStatus,
  type LessonSearchInput,
  type LessonStoreOptions,
  type ListLessonEntriesInput
} from "@keiba-ai-assistant/storage";

/** lessons コマンド共通のCLIオプション。 */
interface LessonsCommandOptions {
  /** Lesson SQLite DBファイルのパス。 */
  lessonDb?: string | undefined;
  /** Lesson状態の指定。 */
  status?: string | undefined;
  /** 取得件数の上限。 */
  limit?: string | undefined;
  /** タグ検索条件。 */
  tag?: string[] | undefined;
}

/** lessons コマンドのテスト差し替え用依存関係。 */
export interface LessonsCommandDependencies {
  /** Lesson一覧を取得する関数。 */
  listLessonEntries?: typeof listLessonEntries | undefined;
  /** Lessonを検索する関数。 */
  searchLessonEntries?: typeof searchLessonEntries | undefined;
  /** Lesson状態を更新する関数。 */
  updateLessonEntryStatus?: typeof updateLessonEntryStatus | undefined;
  /** CLI にメッセージを出力する関数。 */
  log?: ((message: string) => void) | undefined;
}

/** 反省Lessonの一覧、検索、承認、アーカイブを扱うCLIコマンドを登録する。 */
export const registerLessonsCommand = (
  program: Command,
  dependencies: LessonsCommandDependencies = {}
): void => {
  const deps = {
    listLessonEntries: dependencies.listLessonEntries ?? listLessonEntries,
    searchLessonEntries: dependencies.searchLessonEntries ?? searchLessonEntries,
    updateLessonEntryStatus: dependencies.updateLessonEntryStatus ?? updateLessonEntryStatus,
    log: dependencies.log ?? console.log
  };
  const lessons = program.command("lessons").description("Manage reflection lessons");

  lessons
    .command("list")
    .description("List reflection lessons")
    .option("--status <status>", "Lesson status: draft, approved, archived")
    .option("--limit <number>", "Maximum number of lessons")
    .option("--lesson-db <path>", "Lesson SQLite database path")
    .action(async (options: LessonsCommandOptions) => {
      const entries = await deps.listLessonEntries(
        buildListLessonEntriesInput(options),
        buildLessonStoreOptions(options)
      );
      printLessonEntries(entries, deps.log);
    });

  lessons
    .command("search")
    .description("Search reflection lessons")
    .argument("[query]", "FTS query")
    .option("--tag <tag>", "Tag filter", collectTagOption, [])
    .option("--status <status>", "Lesson status: draft, approved, archived")
    .option("--limit <number>", "Maximum number of lessons")
    .option("--lesson-db <path>", "Lesson SQLite database path")
    .action(async (query: string | undefined, options: LessonsCommandOptions) => {
      const results = await deps.searchLessonEntries(
        buildLessonSearchInput(query, options),
        buildLessonStoreOptions(options)
      );
      if (results.length === 0) {
        deps.log("Lessonは見つかりませんでした。");
        return;
      }

      for (const result of results) {
        deps.log(
          `${formatLessonEntry(result.lesson)}\n  score: ${result.score.toFixed(2)}\n  matchedTags: ${
            result.matchedTags.length === 0 ? "-" : result.matchedTags.join(", ")
          }`
        );
      }
    });

  lessons
    .command("approve")
    .description("Approve a draft lesson")
    .argument("<lessonId>", "Lesson ID")
    .option("--lesson-db <path>", "Lesson SQLite database path")
    .action(async (lessonId: string, options: LessonsCommandOptions) => {
      await deps.updateLessonEntryStatus(lessonId, "approved", buildLessonStoreOptions(options));
      deps.log(`Lessonを承認しました: ${lessonId}`);
    });

  lessons
    .command("archive")
    .description("Archive a lesson")
    .argument("<lessonId>", "Lesson ID")
    .option("--lesson-db <path>", "Lesson SQLite database path")
    .action(async (lessonId: string, options: LessonsCommandOptions) => {
      await deps.updateLessonEntryStatus(lessonId, "archived", buildLessonStoreOptions(options));
      deps.log(`Lessonをアーカイブしました: ${lessonId}`);
    });
};

/** Commanderの複数 --tag 指定を配列として集約する。 */
const collectTagOption = (value: string, previous: string[]): string[] => {
  return [...previous, value];
};

/** CLI オプションからLesson一覧取得入力を組み立てる。 */
const buildListLessonEntriesInput = (options: LessonsCommandOptions): ListLessonEntriesInput => {
  const input: ListLessonEntriesInput = {};
  const status = parseOptionalLessonStatus(options.status);
  if (status !== undefined) {
    input.status = status;
  }
  const limit = parseOptionalLimit(options.limit);
  if (limit !== undefined) {
    input.limit = limit;
  }

  return input;
};

/** CLI オプションからLesson検索入力を組み立てる。 */
const buildLessonSearchInput = (
  query: string | undefined,
  options: LessonsCommandOptions
): LessonSearchInput => {
  const input: LessonSearchInput = {};
  const trimmedQuery = query?.trim();
  if (trimmedQuery !== undefined && trimmedQuery.length > 0) {
    input.query = trimmedQuery;
  }
  const status = parseOptionalLessonStatus(options.status);
  if (status !== undefined) {
    input.status = status;
  }
  const limit = parseOptionalLimit(options.limit);
  if (limit !== undefined) {
    input.limit = limit;
  }
  if (options.tag !== undefined && options.tag.length > 0) {
    input.tags = options.tag;
  }

  return input;
};

/** CLI オプションからLesson DBの読み書き設定を組み立てる。 */
const buildLessonStoreOptions = (options: LessonsCommandOptions): LessonStoreOptions => {
  if (options.lessonDb === undefined) {
    return {};
  }

  return { dbPath: options.lessonDb };
};

const parseOptionalLessonStatus = (value: string | undefined): LessonStatus | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const result = lessonStatusSchema.safeParse(value);
  if (!result.success) {
    throw new Error("status は draft, approved, archived のいずれかを指定してください。");
  }

  return result.data;
};

const parseOptionalLimit = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("limit は1以上の整数で指定してください。");
  }

  return limit;
};

const printLessonEntries = (entries: LessonEntry[], log: (message: string) => void): void => {
  if (entries.length === 0) {
    log("Lessonは見つかりませんでした。");
    return;
  }

  for (const entry of entries) {
    log(formatLessonEntry(entry));
  }
};

const formatLessonEntry = (entry: LessonEntry): string => {
  return [
    `${entry.id} [${entry.status}] ${entry.title}`,
    `  situation: ${entry.situationKey}`,
    `  tags: ${entry.tags.length === 0 ? "-" : entry.tags.join(", ")}`,
    `  guidance: ${entry.decisionGuidance}`
  ].join("\n");
};
