import type { Prediction, PredictionLessonReference, Race } from "@keiba-ai-assistant/models";
import type { LessonSearchInput } from "@keiba-ai-assistant/storage/lesson-store";

/** RaceからLesson検索用の自然文クエリと短いタグを組み立てる。 */
export const buildLessonSearchInputFromRace = (race: Race): LessonSearchInput => {
  const surface = race.surface === "turf" ? "芝" : race.surface === "dirt" ? "ダート" : undefined;
  const optionalTerms = [
    race.racecourse,
    surface,
    `${race.distanceMeters}m`,
    race.direction,
    race.trackCondition,
    race.weather?.condition
  ].filter((term): term is string => term !== undefined && term.length > 0);
  const runningStyleTags = race.horses.flatMap((horse) =>
    horse.pastPerformances
      .map((performance) => performance.runningStyle)
      .filter((style): style is string => style !== undefined && style.length > 0)
  );

  return {
    query: optionalTerms.join(" "),
    tags: [...optionalTerms, ...runningStyleTags],
    limit: 10,
    status: "approved"
  };
};

/** Predictionに含まれる採用LessonをDB保存用の参照履歴へ変換する。 */
export const buildPredictionLessonReferences = (
  prediction: Prediction
): PredictionLessonReference[] => {
  const predictionId = `${prediction.raceId}:${prediction.generatedAt}`;
  return prediction.referencedLessons.map((reference) => ({
    raceId: prediction.raceId,
    predictionId,
    lessonId: reference.lessonId,
    reason: reference.reason,
    usedAt: prediction.generatedAt
  }));
};
