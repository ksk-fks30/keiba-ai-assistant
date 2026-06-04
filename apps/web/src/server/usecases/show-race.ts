import type { Prediction, QaEntry, Race } from "@keiba-ai-assistant/models";
import type { RunRepository } from "@keiba-ai-assistant/web/server/repositories/run-repository";

/** race詳細ページの入力。 */
export interface ShowRaceInput {
  /** URLパラメータで指定されたrace ID。 */
  raceId: string;
  /** 直前の追加質問で発生したエラー。ない場合はundefined。 */
  askError?: string | undefined;
}

/** race詳細ページusecaseの依存関係。 */
export interface ShowRaceDependencies {
  /** 保存済みrunを取得するrepository。 */
  runRepository: RunRepository;
}

/** race詳細ページpropsを取得するusecase。 */
export type ShowRaceUseCase = (input: ShowRaceInput) => Promise<RaceShowPageProps>;

/** race詳細ページに渡すInertia props。 */
export interface RaceShowPageProps {
  /** URLパラメータで指定されたrace ID。 */
  raceId: string;
  /** 保存済みrace.jsonを検証したdomain model。見つからない場合はnull。 */
  race: Race | null;
  /** 保存済みprediction.jsonを検証したdomain model。見つからない場合はnull。 */
  prediction: Prediction | null;
  /** 保存済みqa.jsonlを検証したdomain model配列。見つからない場合は空配列。 */
  qaEntries: QaEntry[];
  /** 直前の追加質問で発生したエラー。ない場合はnull。 */
  askError: string | null;
}

/** repositoryを注入して、race IDからダッシュボード表示用propsを取得するusecaseを作る。 */
export const createShowRaceUseCase = (dependencies: ShowRaceDependencies): ShowRaceUseCase => {
  return async (input) => {
    const race = await dependencies.runRepository.findRaceById(input.raceId);
    if (race === null) {
      return {
        raceId: input.raceId,
        race: null,
        prediction: null,
        qaEntries: [],
        askError: input.askError ?? null
      };
    }
    const [prediction, qaEntries] = await Promise.all([
      dependencies.runRepository.findPredictionByRaceId(input.raceId),
      dependencies.runRepository.findQaEntriesByRaceId(input.raceId)
    ]);

    return {
      raceId: input.raceId,
      race,
      prediction,
      qaEntries,
      askError: input.askError ?? null
    };
  };
};
