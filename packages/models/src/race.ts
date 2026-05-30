import { z } from "zod";
import { horseSchema } from "@keiba-ai-assistant/models/horse";
import { raceSurfaceSchema } from "@keiba-ai-assistant/models/race-surface";
import { weatherSchema } from "@keiba-ai-assistant/models/weather";

/** レースモデル。対象レースの条件、天気、出走馬、取得日時を表す。 */
export const raceSchema = z.object({
  // データ取得元で安定して参照できるレースID。
  id: z.string(),
  // レース情報の取得元URL。
  sourceUrl: z.string().url(),
  // レース名。
  name: z.string(),
  // 競馬場名。
  racecourse: z.string(),
  // 発走予定時刻。
  startTime: z.string().optional(),
  // 馬場種別。
  surface: raceSurfaceSchema.default("unknown"),
  // レース距離。メートル単位。
  distanceMeters: z.number().int().positive(),
  // コースの回り方向またはレイアウト表記。
  direction: z.string().optional(),
  // 馬場状態。
  trackCondition: z.string().optional(),
  // レース時点に紐づく天気情報。
  weather: weatherSchema.optional(),
  // 出走馬一覧。
  horses: z.array(horseSchema),
  // レースデータを取得した日時。
  collectedAt: z.string()
});

export type Race = z.infer<typeof raceSchema>;

export function parseRace(value: unknown): Race {
  return raceSchema.parse(value);
}
