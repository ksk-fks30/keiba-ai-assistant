import { z } from "zod";
import { betCandidateSchema } from "@keiba-ai-assistant/models/bet-candidate";
import { horseEvaluationSchema } from "@keiba-ai-assistant/models/horse-evaluation";

/** 予想結果モデル。レース全体の見立て、馬ごとの評価、買い目候補、生成情報を表す。 */
export const predictionSchema = z.object({
  // この予想結果が対象とするレースID。
  raceId: z.string(),
  // レース全体の予想サマリー。
  summary: z.string(),
  // 出走馬ごとの評価。
  evaluations: z.array(horseEvaluationSchema),
  // 推奨する買い目候補。
  betCandidates: z.array(betCandidateSchema),
  // 予想を生成した日時。
  generatedAt: z.string()
});

export type Prediction = z.infer<typeof predictionSchema>;

/** Prediction ZodスキーマからJSON Schemaを生成する。 */
export const buildPredictionJsonSchema = (): unknown => {
  const jsonSchema = z.toJSONSchema(predictionSchema);
  delete jsonSchema.$schema;
  return jsonSchema;
};

export const parsePrediction = (value: unknown): Prediction => {
  return predictionSchema.parse(value);
};
