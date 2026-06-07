import type {
  LessonEntry,
  LessonStatus,
  PredictionLessonReference
} from "@keiba-ai-assistant/models";
import {
  findLessonEntriesByIds,
  findLessonEntryById,
  recordPredictionLessonReferences,
  saveLessonEntry,
  searchLessonEntries,
  updateLessonEntryStatus,
  type LessonSearchInput,
  type LessonSearchResult,
  type LessonStoreOptions
} from "@keiba-ai-assistant/storage";

/** Web画面からSQLiteのLessonを扱うrepository。 */
export interface LessonRepository {
  /** LessonをSQLiteへ保存する。 */
  saveLessonEntry: (lesson: LessonEntry) => Promise<void>;
  /** 指定ID群のLessonを入力順で返す。存在しないIDは除外する。 */
  findLessonEntriesByIds: (lessonIds: string[]) => Promise<LessonEntry[]>;
  /** 予想時に参照するLesson候補を検索する。 */
  searchLessonEntries: (input: LessonSearchInput) => Promise<LessonSearchResult[]>;
  /** 予想で採用したLesson参照履歴を保存する。 */
  recordPredictionLessonReferences: (references: PredictionLessonReference[]) => Promise<void>;
  /** Lessonの状態を更新し、更新後のLessonを返す。 */
  updateLessonStatus: (lessonId: string, status: LessonStatus) => Promise<LessonEntry>;
}

/** lesson repository の生成オプション。 */
export interface CreateLessonRepositoryOptions {
  /** `packages/storage` に渡すLesson DB設定。 */
  lessonStoreOptions?: LessonStoreOptions;
}

/** SQLiteのLesson storeをWeb usecase向けに包むrepositoryを作る。 */
export const createLessonRepository = (
  options: CreateLessonRepositoryOptions = {}
): LessonRepository => {
  const lessonStoreOptions = options.lessonStoreOptions ?? {};

  return {
    saveLessonEntry: async (lesson) => {
      await saveLessonEntry(lesson, lessonStoreOptions);
    },
    findLessonEntriesByIds: async (lessonIds) => {
      return await findLessonEntriesByIds(lessonIds, lessonStoreOptions);
    },
    searchLessonEntries: async (input) => {
      return await searchLessonEntries(input, lessonStoreOptions);
    },
    recordPredictionLessonReferences: async (references) => {
      await recordPredictionLessonReferences(references, lessonStoreOptions);
    },
    updateLessonStatus: async (lessonId, status) => {
      await updateLessonEntryStatus(lessonId, status, lessonStoreOptions);
      const lesson = await findLessonEntryById(lessonId, lessonStoreOptions);
      if (lesson === null) {
        throw new Error(`Lessonが見つかりません: ${lessonId}`);
      }

      return lesson;
    }
  };
};
