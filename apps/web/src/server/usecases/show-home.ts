import type {
  RunRepository,
  SavedRaceRun
} from "@keiba-ai-assistant/web/server/repositories/run-repository";

/** トップ画面に渡すInertia props。 */
export interface HomePageProps {
  /** 保存済みrunの一覧。 */
  runs: SavedRaceRun[];
}

/** トップ画面usecaseの依存関係。 */
export interface ShowHomeUseCaseDependencies {
  /** 保存済みrunを取得するrepository。 */
  runRepository: RunRepository;
}

/** トップ画面に必要な保存済みレース一覧とエラー状態を返すusecase。 */
export type ShowHomeUseCase = () => Promise<HomePageProps>;

/** repositoryを注入してトップ画面usecaseを作る。 */
export const createShowHomeUseCase = (
  dependencies: ShowHomeUseCaseDependencies
): ShowHomeUseCase => {
  return async () => {
    const runs = await dependencies.runRepository.findSavedRaceRuns();

    return {
      runs: sortRunsByRaceStartTime(runs)
    };
  };
};

/** run一覧を開催日時の新しい順へ並べる。開催日時が同じ場合だけ更新日時で補助的に並べる。 */
const sortRunsByRaceStartTime = (runs: SavedRaceRun[]): SavedRaceRun[] => {
  return [...runs].sort((left, right) => {
    const raceStartDiff =
      readSortableTime(right.race?.startTime) - readSortableTime(left.race?.startTime);
    if (raceStartDiff !== 0) {
      return raceStartDiff;
    }

    return readSortableTime(right.updatedAt) - readSortableTime(left.updatedAt);
  });
};

/** 日時文字列を降順sort用の数値に変換する。不明な日時は末尾に寄せる。 */
const readSortableTime = (value: string | undefined): number => {
  if (value === undefined) {
    return Number.NEGATIVE_INFINITY;
  }

  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return Number.NEGATIVE_INFINITY;
  }

  return time;
};
