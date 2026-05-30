import { z } from "zod";
import { pastPerformanceSchema } from "@keiba-ai-assistant/models/past-performance";
import { pedigreeSchema } from "@keiba-ai-assistant/models/pedigree";

/** 出走馬モデル。レースに出走する1頭の基本情報、血統、直近成績を表す。 */
export const horseSchema = z.object({
  // データ取得元で安定して参照できる馬ID。
  id: z.string(),
  // 馬名。
  name: z.string(),
  // 枠番。
  gateNumber: z.number().int().positive().optional(),
  // 馬番。
  horseNumber: z.number().int().positive().optional(),
  // 性別表記。
  sex: z.string().optional(),
  // 馬齢。
  age: z.number().int().positive().optional(),
  // 今回騎乗する騎手。
  jockey: z.string().optional(),
  // 管理調教師。
  trainer: z.string().optional(),
  // 馬体重。kg単位。
  bodyWeightKg: z.number().int().positive().optional(),
  // 前回発表値からの馬体重増減。kg単位。
  bodyWeightDiffKg: z.number().int().optional(),
  // 現在の単勝オッズ。
  odds: z.number().positive().optional(),
  // オッズに基づく人気順。
  popularity: z.number().int().positive().optional(),
  // 適性分析に使う血統情報。
  pedigree: pedigreeSchema.default({ familyNotes: [] }),
  // 直近の過去走。最大5走まで保持する。
  pastPerformances: z.array(pastPerformanceSchema).max(5).default([])
});

export type Horse = z.infer<typeof horseSchema>;

export function parseHorse(value: unknown): Horse {
  return horseSchema.parse(value);
}
