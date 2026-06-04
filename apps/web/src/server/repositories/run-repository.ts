import type { Prediction, QaEntry, Race } from "@keiba-ai-assistant/models";
import {
  appendQaEntry as appendStoredQaEntry,
  invalidateRunAnalysis,
  listRuns,
  readPrediction,
  readQaEntries,
  readRace,
  writePrediction,
  writeRace,
  type RunStoreOptions
} from "@keiba-ai-assistant/storage";
import { isMissingFileError } from "@keiba-ai-assistant/storage/file-system";

/** Web画面で扱う、保存済みrunの状態とRace modelの組み合わせ。 */
export interface SavedRaceRun {
  /** run の識別子。通常は race ID と同じ値。 */
  raceId: string;
  /** 保存済みRace。race.json がない場合はnull。 */
  race: Race | null;
  /** `prediction.json` が保存済みかどうか。 */
  hasPrediction: boolean;
  /** `qa.jsonl` が保存済みかどうか。 */
  hasQa: boolean;
  /** run ディレクトリの最終更新日時。 */
  updatedAt: string;
}

/** 保存済みrunからWeb表示に必要なdomain modelを取得するrepository。 */
export interface RunRepository {
  /** 保存済みrunの一覧を、読み込めるRace model付きで返す。 */
  findSavedRaceRuns: () => Promise<SavedRaceRun[]>;
  /** 指定race IDのRaceを返す。保存済みrace.jsonがない場合はnullを返す。 */
  findRaceById: (raceId: string) => Promise<Race | null>;
  /** 指定race IDのPredictionを返す。保存済みprediction.jsonがない場合はnullを返す。 */
  findPredictionByRaceId: (raceId: string) => Promise<Prediction | null>;
  /** 指定race IDのQ&A履歴を返す。保存済みqa.jsonlがない場合は空配列を返す。 */
  findQaEntriesByRaceId: (raceId: string) => Promise<QaEntry[]>;
  /** Raceを対象runへ保存する。 */
  saveRace: (race: Race) => Promise<void>;
  /** Predictionを対象runへ保存する。 */
  savePrediction: (prediction: Prediction) => Promise<void>;
  /** 既存の分析結果とQ&A履歴を無効化する。 */
  invalidateAnalysis: (raceId: string) => Promise<void>;
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
    findSavedRaceRuns: async () => {
      const summaries = await listRuns(runStoreOptions);
      return await Promise.all(
        summaries.map(async (summary) => ({
          raceId: summary.raceId,
          race: summary.hasRace ? await readOptionalRace(summary.raceId, runStoreOptions) : null,
          hasPrediction: summary.hasPrediction,
          hasQa: summary.hasQa,
          updatedAt: summary.updatedAt
        }))
      );
    },
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
    saveRace: async (race) => {
      await writeRace(race, runStoreOptions);
    },
    savePrediction: async (prediction) => {
      await writePrediction(prediction, runStoreOptions);
    },
    invalidateAnalysis: async (raceId) => {
      await invalidateRunAnalysis(raceId, runStoreOptions);
    },
    appendQaEntry: async (entry) => {
      await appendStoredQaEntry(entry, runStoreOptions);
    }
  };
};

/** 一覧表示用にRaceを読み込む。削除直後などrace.jsonがない場合だけnullにする。 */
const readOptionalRace = async (
  raceId: string,
  runStoreOptions: RunStoreOptions
): Promise<Race | null> => {
  try {
    return await readRace(raceId, runStoreOptions);
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
};
