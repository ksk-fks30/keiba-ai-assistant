import type { Race } from "@keiba-ai-assistant/models";
import type { RunRepository } from "@keiba-ai-assistant/web/server/repositories/run-repository";

/** race詳細ページの入力。 */
export interface ShowRaceInput {
  /** URLパラメータで指定されたrace ID。 */
  raceId: string;
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
}

/** repositoryを注入して、race IDからダッシュボード表示用propsを取得するusecaseを作る。 */
export const createShowRaceUseCase = (dependencies: ShowRaceDependencies): ShowRaceUseCase => {
  return async (input) => {
    const race = await dependencies.runRepository.findRaceById(input.raceId);

    return {
      raceId: input.raceId,
      race
    };
  };
};
