import { z } from "zod";

/** 天気モデル。レース時点の天候、降水確率、気温、風、取得元を表す。 */
export const weatherSchema = z.object({
  // 天候の表記。
  condition: z.string().optional(),
  // 降水確率。パーセント単位。
  precipitationProbability: z.number().min(0).max(100).optional(),
  // 気温。摂氏単位。
  temperatureCelsius: z.number().optional(),
  // 取得元が示す風の情報。
  wind: z.string().optional(),
  // 天気情報の提供元または取得元URL。
  source: z.string().optional(),
  // 観測または予報が記録された日時。
  observedAt: z.string().optional()
});

export type Weather = z.infer<typeof weatherSchema>;

export function parseWeather(value: unknown): Weather {
  return weatherSchema.parse(value);
}
