import type { HorseMemo } from "@keiba-ai-assistant/models";
import {
  deleteHorseMemo as deleteStoredHorseMemo,
  listHorseMemos,
  writeHorseMemo,
  type HorseMemoStoreOptions
} from "@keiba-ai-assistant/storage";

/** Web画面からSQLiteの出走馬メモを扱うrepository。 */
export interface HorseMemoRepository {
  /** 指定race IDに保存された出走馬メモを返す。 */
  findHorseMemosByRaceId: (raceId: string) => Promise<HorseMemo[]>;
  /** 出走馬メモをSQLiteへ保存する。 */
  saveHorseMemo: (memo: HorseMemo) => Promise<HorseMemo>;
  /** 指定race IDと馬IDの出走馬メモを削除する。 */
  deleteHorseMemo: (raceId: string, horseId: string) => Promise<void>;
}

/** horse memo repository の生成オプション。 */
export interface CreateHorseMemoRepositoryOptions {
  /** `packages/storage` に渡すWebメモDB設定。 */
  horseMemoStoreOptions?: HorseMemoStoreOptions;
}

/** SQLiteの出走馬メモ storeをWeb usecase向けに包むrepositoryを作る。 */
export const createHorseMemoRepository = (
  options: CreateHorseMemoRepositoryOptions = {}
): HorseMemoRepository => {
  const horseMemoStoreOptions = options.horseMemoStoreOptions ?? {};

  return {
    findHorseMemosByRaceId: async (raceId) => {
      return await listHorseMemos(raceId, horseMemoStoreOptions);
    },
    saveHorseMemo: async (memo) => {
      return await writeHorseMemo(memo, horseMemoStoreOptions);
    },
    deleteHorseMemo: async (raceId, horseId) => {
      await deleteStoredHorseMemo(raceId, horseId, horseMemoStoreOptions);
    }
  };
};
