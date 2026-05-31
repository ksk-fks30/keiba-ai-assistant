import { z } from "zod";

/** Q&A履歴モデル。特定レースに対する質問と回答の1件分を表す。 */
export const qaEntrySchema = z.object({
  // Q&A履歴内で安定して参照できるID。
  id: z.string(),
  // このQ&Aが対象とするレースID。
  raceId: z.string(),
  // ユーザーからの質問。
  question: z.string(),
  // AIが生成した回答。
  answer: z.string(),
  // このQ&Aを作成した日時。
  createdAt: z.string()
});

export type QaEntry = z.infer<typeof qaEntrySchema>;

export const parseQaEntry = (value: unknown): QaEntry => {
  return qaEntrySchema.parse(value);
};
