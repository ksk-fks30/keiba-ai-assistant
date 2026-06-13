import type { HorseMemo, HorseMemoMark } from "@keiba-ai-assistant/models";
import type { HorseMemoRepository } from "@keiba-ai-assistant/web/server/repositories/horse-memo-repository";
import type { RunRepository } from "@keiba-ai-assistant/web/server/repositories/run-repository";

/** 出走馬メモの手動印保存入力。 */
export interface SaveHorseMemoMarkInput {
  /** URLパラメータで指定されたrace ID。 */
  raceId: string;
  /** 印を付ける馬ID。 */
  horseId: string;
  /** 保存する手動印。未選択の場合はnull。 */
  mark: HorseMemoMark | null;
}

/** 出走馬メモのテキスト本文保存入力。 */
export interface SaveHorseMemoNoteInput {
  /** URLパラメータで指定されたrace ID。 */
  raceId: string;
  /** メモ本文を保存する馬ID。 */
  horseId: string;
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

/** 出走馬メモの手動印保存usecase。 */
export type SaveHorseMemoMarkUseCase = (input: SaveHorseMemoMarkInput) => Promise<HorseMemo | null>;

/** 出走馬メモのテキスト本文保存usecase。 */
export type SaveHorseMemoNoteUseCase = (input: SaveHorseMemoNoteInput) => Promise<HorseMemo | null>;

/** repositoryを注入して、手動印だけを保存するusecaseを作る。 */
export const createSaveHorseMemoMarkUseCase = (
  dependencies: SaveHorseMemoDependencies
): SaveHorseMemoMarkUseCase => {
  const now = dependencies.now ?? (() => new Date());

  return async (input) => {
    await assertHorseMemoTargetExists(dependencies.runRepository, input.raceId, input.horseId);

    const timestamp = now().toISOString();
    return await dependencies.horseMemoRepository.saveHorseMemoMark({
      raceId: input.raceId,
      horseId: input.horseId,
      mark: input.mark,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  };
};

/** repositoryを注入して、テキスト本文だけを保存するusecaseを作る。 */
export const createSaveHorseMemoNoteUseCase = (
  dependencies: SaveHorseMemoDependencies
): SaveHorseMemoNoteUseCase => {
  const now = dependencies.now ?? (() => new Date());

  return async (input) => {
    await assertHorseMemoTargetExists(dependencies.runRepository, input.raceId, input.horseId);

    const timestamp = now().toISOString();
    return await dependencies.horseMemoRepository.saveHorseMemoNote({
      raceId: input.raceId,
      horseId: input.horseId,
      note: input.note,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  };
};

/** 出走馬メモ保存対象のraceと馬IDが存在することを確認する。 */
const assertHorseMemoTargetExists = async (
  runRepository: RunRepository,
  raceId: string,
  horseId: string
): Promise<void> => {
  const race = await runRepository.findRaceById(raceId);
  if (race === null) {
    throw new Error(`race.json が見つかりません: ${raceId}`);
  }
  if (race.horses.every((horse) => horse.id !== horseId)) {
    throw new Error(`出走馬が見つかりません: ${raceId}/${horseId}`);
  }
};
