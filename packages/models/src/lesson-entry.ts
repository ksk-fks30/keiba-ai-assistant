import { z } from "zod";

/** Lesson の利用状態。予想時に参照してよいかを制御する。 */
export const lessonStatusSchema = z.enum(["draft", "approved", "archived"]);

export type LessonStatus = z.infer<typeof lessonStatusSchema>;

/** Lesson の確信度。単一レースの反省をどれくらい一般化してよいかを表す。 */
export const lessonConfidenceSchema = z.enum(["low", "medium", "high"]);

export type LessonConfidence = z.infer<typeof lessonConfidenceSchema>;

/** 反省から抽出した、次回以降の予想で再利用できる知見モデル。 */
export const lessonEntrySchema = z.object({
  // Lesson を安定して参照するためのID。
  id: z.string(),
  // このLessonの元になったレースID。
  sourceRaceId: z.string(),
  // 予想時に参照してよいかを制御する状態。
  status: lessonStatusSchema,
  // Lessonの短い見出し。
  title: z.string(),
  // 人間が読める状況キー。
  situationKey: z.string(),
  // 検索やスコアリングに使う短い競馬キーワード。
  tags: z.array(z.string()),
  // 具体的なレース反省を日記形式で残す本文。
  diaryText: z.string(),
  // 次回以降にどう判断するかを表す指針。
  decisionGuidance: z.string(),
  // このLessonを使ってよい条件。
  applicableWhen: z.array(z.string()),
  // このLessonを使うべきではない条件。
  notApplicableWhen: z.array(z.string()),
  // Lessonの一般化に対する確信度。
  confidence: lessonConfidenceSchema,
  // Lessonを作成した日時。
  createdAt: z.string(),
  // Lessonを最後に更新した日時。
  updatedAt: z.string()
});

export type LessonEntry = z.infer<typeof lessonEntrySchema>;

export const parseLessonEntry = (value: unknown): LessonEntry => {
  return lessonEntrySchema.parse(value);
};
