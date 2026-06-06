import { z } from "zod";

/** レース振り返りモデル。結果と予想を照合したAIの振り返り本文を表す。 */
export const raceReflectionSchema = z.object({
  // 対象レースID。
  raceId: z.string(),
  // 振り返りを作成した日時。
  reflectedAt: z.string(),
  // AIによる振り返り本文。
  summary: z.string(),
  // この振り返りから抽出してDBに保存したLesson ID。
  lessonIds: z.array(z.string())
});

export type RaceReflection = z.infer<typeof raceReflectionSchema>;

export const parseRaceReflection = (value: unknown): RaceReflection => {
  return raceReflectionSchema.parse(value);
};
