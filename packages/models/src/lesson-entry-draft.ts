import { z } from "zod";
import { lessonConfidenceSchema } from "@keiba-ai-assistant/models/lesson-entry";

/** 振り返りから抽出したLesson下書き。IDや状態、時刻は保存時にアプリ側で付与する。 */
export const lessonEntryDraftSchema = z.object({
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
  confidence: lessonConfidenceSchema
});

export type LessonEntryDraft = z.infer<typeof lessonEntryDraftSchema>;

export const parseLessonEntryDraft = (value: unknown): LessonEntryDraft => {
  return lessonEntryDraftSchema.parse(value);
};
