import { z } from "zod";

/** AIが出走馬評価に付与できる印の内部値一覧。 */
export const horseEvaluationMarks = [
  "favorite",
  "second",
  "third",
  "longshot",
  "watch",
  "dismiss"
] as const;

/** AIが出走馬評価に付与する印の内部値。 */
export type HorseEvaluationMark = (typeof horseEvaluationMarks)[number];

/** 馬評価モデル。1頭ごとの印、スコア、評価理由、リスクを表す。 */
export const horseEvaluationSchema = z.object({
  // 評価対象の馬ID。
  horseId: z.string(),
  // 分析で付与した印。
  mark: z.enum(horseEvaluationMarks),
  // 評価スコア。0から100で表す。
  score: z.number().min(0).max(100),
  // 評価を支持する理由。
  reasons: z.array(z.string()),
  // 不安要素や評価上のリスク。
  risks: z.array(z.string())
});

export type HorseEvaluation = z.infer<typeof horseEvaluationSchema>;

export const parseHorseEvaluation = (value: unknown): HorseEvaluation => {
  return horseEvaluationSchema.parse(value);
};
