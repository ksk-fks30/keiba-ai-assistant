import { parseHorseMemo, type HorseMemo, type HorseMemoMark } from "@keiba-ai-assistant/models";
import type { HorseMemoRepository } from "@keiba-ai-assistant/web/server/repositories/horse-memo-repository";
import type { RunRepository } from "@keiba-ai-assistant/web/server/repositories/run-repository";

/** 出走馬メモ保存の入力。 */
export interface SaveHorseMemoInput {
  /** URLパラメータで指定されたrace ID。 */
  raceId: string;
  /** 印を付ける馬ID。 */
  horseId: string;
  /** 保存する手動印。未選択の場合はnull。 */
  mark: HorseMemoMark | null;
  /** 保存するテキストメモ。空文字の場合はメモ本文なしとして扱う。 */
  note: string;
}

/** 出走馬メモ保存usecaseの依存関係。 */
export interface SaveHorseMemoDependencies {
  /** 保存済みrunを取得するrepository。 */
  runRepository: RunRepository;
  /** 出走馬メモを保存するrepository。 */
  horseMemoRepository: HorseMemoRepository;
  /** 現在日時を返す関数。テストで固定する。 */
  now?: (() => Date) | undefined;
}

/** 出走馬メモを保存または削除するusecase。 */
export type SaveHorseMemoUseCase = (input: SaveHorseMemoInput) => Promise<HorseMemo | null>;

/** repositoryを注入して、出走馬メモ保存usecaseを作る。 */
export const createSaveHorseMemoUseCase = (
  dependencies: SaveHorseMemoDependencies
): SaveHorseMemoUseCase => {
  const now = dependencies.now ?? (() => new Date());

  return async (input) => {
    const race = await dependencies.runRepository.findRaceById(input.raceId);
    if (race === null) {
      throw new Error(`race.json が見つかりません: ${input.raceId}`);
    }
    if (race.horses.every((horse) => horse.id !== input.horseId)) {
      throw new Error(`出走馬が見つかりません: ${input.raceId}/${input.horseId}`);
    }

    if (input.mark === null && input.note.length === 0) {
      await dependencies.horseMemoRepository.deleteHorseMemo(input.raceId, input.horseId);
      return null;
    }

    const timestamp = now().toISOString();
    const memo = parseHorseMemo({
      raceId: input.raceId,
      horseId: input.horseId,
      mark: input.mark,
      note: input.note,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    return await dependencies.horseMemoRepository.saveHorseMemo(memo);
  };
};
