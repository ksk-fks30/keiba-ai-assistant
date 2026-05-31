import { z } from "zod";
import { raceDraftPastPerformanceSchema } from "@keiba-ai-assistant/models/race-draft-past-performance";
import { raceDraftPedigreeSchema } from "@keiba-ai-assistant/models/race-draft-pedigree";

/** レース取得下書き用の出走馬モデル。AIがページsnapshotから読み取る出走馬、血統、直近成績を表す。 */
export const raceDraftHorseSchema = z.object({
  // データ取得元で安定して参照できる馬ID。不明な場合は馬番由来の安定IDを使う。
  id: z.string().min(1),
  // 馬名。
  name: z.string().min(1),
  // 馬番。
  horseNumber: z.number().int().positive(),
  // 今回騎乗する騎手。
  jockey: z.string().min(1),
  // 適性分析に使う血統情報。
  pedigree: raceDraftPedigreeSchema,
  // 直近の過去走。最大5走まで保持する。
  pastPerformances: z.array(raceDraftPastPerformanceSchema).max(5)
});

export type RaceDraftHorse = z.infer<typeof raceDraftHorseSchema>;

export const parseRaceDraftHorse = (value: unknown): RaceDraftHorse => {
  return raceDraftHorseSchema.parse(value);
};
