import { z } from "zod";

/** 予想とLessonの参照履歴モデル。SQLiteに保存する横断分析用の履歴を表す。 */
export const predictionLessonReferenceSchema = z.object({
  // 予想対象のレースID。
  raceId: z.string(),
  // 予想生成単位を識別するID。
  predictionId: z.string(),
  // 参照したLessonのID。
  lessonId: z.string(),
  // 予想時にLessonを採用した理由。
  reason: z.string(),
  // 参照履歴を記録した日時。
  usedAt: z.string()
});

export type PredictionLessonReference = z.infer<typeof predictionLessonReferenceSchema>;

export const parsePredictionLessonReference = (value: unknown): PredictionLessonReference => {
  return predictionLessonReferenceSchema.parse(value);
};
