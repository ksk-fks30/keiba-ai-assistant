import { z } from "zod";
import { raceSurfaceSchema } from "@keiba-ai-assistant/models/race-surface";

/** 過去走モデル。出走馬の過去レース1件分の結果と条件を表す。 */
export const pastPerformanceSchema = z.object({
  // レース日。
  date: z.string(),
  // 過去走のレース名。
  raceName: z.string(),
  // 過去走が行われた競馬場。
  racecourse: z.string().optional(),
  // 過去走の馬場種別。
  surface: raceSurfaceSchema.default("unknown"),
  // レース距離。メートル単位。
  distanceMeters: z.number().int().positive().optional(),
  // 過去走の馬場状態。
  trackCondition: z.string().optional(),
  // 着順。
  finishPosition: z.number().int().positive().optional(),
  // 過去走で騎乗した騎手。
  jockey: z.string().optional(),
  // 斤量。kg単位。
  weightCarriedKg: z.number().positive().optional(),
  // 馬体重。kg単位。
  bodyWeightKg: z.number().int().positive().optional(),
  // 過去走の単勝オッズ。
  odds: z.number().positive().optional(),
  // 過去走の人気順。
  popularity: z.number().int().positive().optional(),
  // 着差やタイム差。
  margin: z.string().optional(),
  // 脚質や通過順などの走り方。
  runningStyle: z.string().optional(),
  // 取得時または分析時に残す補足メモ。
  note: z.string().optional()
});

export type PastPerformance = z.infer<typeof pastPerformanceSchema>;

export const parsePastPerformance = (value: unknown): PastPerformance => {
  return pastPerformanceSchema.parse(value);
};
