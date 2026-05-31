import { z } from "zod";

/** 馬評価モデル。1頭ごとの印、スコア、評価理由、リスクを表す。 */
export const horseEvaluationSchema = z.object({
  // 評価対象の馬ID。
  horseId: z.string(),
  // 分析で付与した印。
  mark: z.enum(["favorite", "second", "third", "longshot", "watch", "dismiss"]),
  // 評価スコア。0から100で表す。
  score: z.number().min(0).max(100),
  // 評価を支持する理由。
  reasons: z.array(z.string()).default([]),
  // 不安要素や評価上のリスク。
  risks: z.array(z.string()).default([])
});

export type HorseEvaluation = z.infer<typeof horseEvaluationSchema>;

export const parseHorseEvaluation = (value: unknown): HorseEvaluation => {
  return horseEvaluationSchema.parse(value);
};
