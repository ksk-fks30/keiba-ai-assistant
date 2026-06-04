import type { Prediction, QaEntry, Race } from "@keiba-ai-assistant/models";
import {
  appendQaEntry as appendStoredQaEntry,
  readPrediction,
  readQaEntries,
  readRace,
  type RunStoreOptions
} from "@keiba-ai-assistant/storage";
import { isMissingFileError } from "@keiba-ai-assistant/storage/file-system";

/** 保存済みrunからWeb表示に必要なdomain modelを取得するrepository。 */
export interface RunRepository {
  /** 指定race IDのRaceを返す。保存済みrace.jsonがない場合はnullを返す。 */
  findRaceById: (raceId: string) => Promise<Race | null>;
  /** 指定race IDのPredictionを返す。保存済みprediction.jsonがない場合はnullを返す。 */
  findPredictionByRaceId: (raceId: string) => Promise<Prediction | null>;
  /** 指定race IDのQ&A履歴を返す。保存済みqa.jsonlがない場合は空配列を返す。 */
  findQaEntriesByRaceId: (raceId: string) => Promise<QaEntry[]>;
  /** 指定race IDのQ&A履歴へ1件追記する。 */
  appendQaEntry: (entry: QaEntry) => Promise<void>;
}

/** run repository の生成オプション。 */
export interface CreateRunRepositoryOptions {
  /** `packages/storage` に渡すrun保存先設定。 */
  runStoreOptions?: RunStoreOptions;
}

/** `runs/` 配下のJSONをstorage経由でRace modelとして読み込むrepositoryを作る。 */
export const createRunRepository = (options: CreateRunRepositoryOptions = {}): RunRepository => {
  const runStoreOptions = options.runStoreOptions ?? {};

  return {
    findRaceById: async (raceId) => {
      try {
        return await readRace(raceId, runStoreOptions);
      } catch (error) {
        if (isMissingFileError(error)) {
          return null;
        }

        throw error;
      }
    },
    findPredictionByRaceId: async (raceId) => {
      try {
        return await readPrediction(raceId, runStoreOptions);
      } catch (error) {
        if (isMissingFileError(error)) {
          return null;
        }

        throw error;
      }
    },
    findQaEntriesByRaceId: async (raceId) => {
      return await readQaEntries(raceId, runStoreOptions);
    },
    appendQaEntry: async (entry) => {
      await appendStoredQaEntry(entry, runStoreOptions);
    }
  };
};
