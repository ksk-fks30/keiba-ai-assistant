import { z } from "zod";
import { raceSurfaceSchema } from "@keiba-ai-assistant/models/race-surface";

/** レース取得下書き用の過去走モデル。AIが馬詳細snapshotから読み取る直近レース情報を表す。 */
export const raceDraftPastPerformanceSchema = z.object({
  // レース日。
  date: z.string(),
  // 過去走のレース名。
  raceName: z.string(),
  // 過去走が行われた競馬場。不明な場合は空文字を入れる。
  racecourse: z.string(),
  // 過去走の馬場種別。
  surface: raceSurfaceSchema,
  // レース距離。メートル単位。不明な場合は null を入れる。
  distanceMeters: z.number().int().positive().nullable(),
  // 過去走の馬場状態。不明な場合は空文字を入れる。
  trackCondition: z.string(),
  // 着順。不明な場合は null を入れる。
  finishPosition: z.number().int().positive().nullable(),
  // 過去走で騎乗した騎手。不明な場合は空文字を入れる。
  jockey: z.string(),
  // 斤量。kg単位。不明な場合は null を入れる。
  weightCarriedKg: z.number().positive().nullable(),
  // 馬体重。kg単位。不明な場合は null を入れる。
  bodyWeightKg: z.number().int().positive().nullable(),
  // 過去走の単勝オッズ。不明な場合は null を入れる。
  odds: z.number().positive().nullable(),
  // 過去走の人気順。不明な場合は null を入れる。
  popularity: z.number().int().positive().nullable(),
  // 着差やタイム差。不明な場合は空文字を入れる。
  margin: z.string(),
  // 脚質や通過順などの走り方。不明な場合は空文字を入れる。
  runningStyle: z.string(),
  // 取得時または分析時に残す補足メモ。不明な場合は空文字を入れる。
  note: z.string()
});

export type RaceDraftPastPerformance = z.infer<typeof raceDraftPastPerformanceSchema>;

export const parseRaceDraftPastPerformance = (value: unknown): RaceDraftPastPerformance => {
  return raceDraftPastPerformanceSchema.parse(value);
};
