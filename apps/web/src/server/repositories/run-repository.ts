import type { Race } from "@keiba-ai-assistant/models";
import { readRace, type RunStoreOptions } from "@keiba-ai-assistant/storage";
import { isMissingFileError } from "@keiba-ai-assistant/storage/file-system";

/** 保存済みrunからWeb表示に必要なdomain modelを取得するrepository。 */
export interface RunRepository {
  /** 指定race IDのRaceを返す。保存済みrace.jsonがない場合はnullを返す。 */
  findRaceById: (raceId: string) => Promise<Race | null>;
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
    }
  };
};
