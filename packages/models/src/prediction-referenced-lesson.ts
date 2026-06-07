import { z } from "zod";

/** 予想時にAIが採用したLessonの参照情報。 */
export const predictionReferencedLessonSchema = z.object({
  // 採用したLessonのID。
  lessonId: z.string(),
  // 予想結果内で見返しやすいLesson見出し。
  title: z.string(),
  // この予想でLessonを採用した理由。
  reason: z.string()
});

export type PredictionReferencedLesson = z.infer<typeof predictionReferencedLessonSchema>;

export const parsePredictionReferencedLesson = (value: unknown): PredictionReferencedLesson => {
  return predictionReferencedLessonSchema.parse(value);
};
