import type {
  HorseMemo,
  LessonEntry,
  Prediction,
  QaEntry,
  Race,
  RaceReflection,
  RaceResult
} from "@keiba-ai-assistant/models";
import type { HorseMemoRepository } from "@keiba-ai-assistant/web/server/repositories/horse-memo-repository";
import type { LessonRepository } from "@keiba-ai-assistant/web/server/repositories/lesson-repository";
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
  /** 振り返りから生成したLessonを取得するrepository。 */
  lessonRepository: LessonRepository;
  /** Web限定の出走馬メモを取得するrepository。 */
  horseMemoRepository: HorseMemoRepository;
  /** 現在日時を返す関数。テストで固定する。 */
  now?: (() => Date) | undefined;
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
  /** Web限定で保存した出走馬メモ。見つからない場合は空配列。 */
  horseMemos: HorseMemo[];
  /** 保存済みresult.jsonを検証したdomain model。見つからない場合はnull。 */
  raceResult: RaceResult | null;
  /** 保存済みreflection.jsonを検証したdomain model。見つからない場合はnull。 */
  raceReflection: RaceReflection | null;
  /** 振り返りから生成したLesson一覧。reflection.jsonがない場合は空配列。 */
  reflectionLessons: LessonEntry[];
  /** 結果取得と振り返りジョブを開始できるかどうか。 */
  canStartReflection: boolean;
  /** 直前の追加質問で発生したエラー。ない場合はnull。 */
  askError: string | null;
}

/** repositoryを注入して、race IDからダッシュボード表示用propsを取得するusecaseを作る。 */
export const createShowRaceUseCase = (dependencies: ShowRaceDependencies): ShowRaceUseCase => {
  const now = dependencies.now ?? (() => new Date());

  return async (input) => {
    const race = await dependencies.runRepository.findRaceById(input.raceId);
    if (race === null) {
      return {
        raceId: input.raceId,
        race: null,
        prediction: null,
        qaEntries: [],
        horseMemos: [],
        raceResult: null,
        raceReflection: null,
        reflectionLessons: [],
        canStartReflection: false,
        askError: input.askError ?? null
      };
    }
    const [prediction, qaEntries, horseMemos, raceResult, raceReflection] = await Promise.all([
      dependencies.runRepository.findPredictionByRaceId(input.raceId),
      dependencies.runRepository.findQaEntriesByRaceId(input.raceId),
      dependencies.horseMemoRepository.findHorseMemosByRaceId(input.raceId),
      dependencies.runRepository.findRaceResultByRaceId(input.raceId),
      dependencies.runRepository.findRaceReflectionByRaceId(input.raceId)
    ]);
    const reflectionLessons =
      raceReflection === null
        ? []
        : await dependencies.lessonRepository.findLessonEntriesByIds(raceReflection.lessonIds);

    return {
      raceId: input.raceId,
      race,
      prediction,
      qaEntries,
      horseMemos,
      raceResult,
      raceReflection,
      reflectionLessons,
      canStartReflection:
        prediction !== null && raceReflection === null && hasRaceStarted(race, now()),
      askError: input.askError ?? null
    };
  };
};

/** 発走時刻が現在時刻より過去かどうかを返す。 */
const hasRaceStarted = (race: Race, currentTime: Date): boolean => {
  if (race.startTime === undefined) {
    return false;
  }

  const startTimeMs = Date.parse(race.startTime);
  if (!Number.isFinite(startTimeMs)) {
    return false;
  }

  return currentTime.getTime() > startTimeMs;
};
