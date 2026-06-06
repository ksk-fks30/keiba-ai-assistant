import { z } from "zod";
import { raceResultEntrySchema } from "@keiba-ai-assistant/models/race-result-entry";

/** レース結果モデル。netKeiba結果ページから取得した確定結果の軽量データを表す。 */
export const raceResultSchema = z.object({
  // 対象レースID。
  raceId: z.string(),
  // 結果情報の取得元URL。
  sourceUrl: z.string().url(),
  // 結果データを取得した日時。
  collectedAt: z.string(),
  // 着順表に表示された結果一覧。
  entries: z.array(raceResultEntrySchema)
});

export type RaceResult = z.infer<typeof raceResultSchema>;

export const parseRaceResult = (value: unknown): RaceResult => {
  return raceResultSchema.parse(value);
};
