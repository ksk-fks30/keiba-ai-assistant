import { z } from "zod";
import { predictionSchema } from "@keiba-ai-assistant/models/prediction";

/** 予想下書きモデル。AIが生成する、生成日時を含まない予想本文を表す。 */
export const predictionDraftSchema = predictionSchema.omit({
  // 生成日時はアプリ側で付与するため、AI出力には含めない。
  generatedAt: true
});

export type PredictionDraft = z.infer<typeof predictionDraftSchema>;

/** PredictionDraft ZodスキーマからJSON Schemaを生成する。 */
export const buildPredictionDraftJsonSchema = (): unknown => {
  const jsonSchema = z.toJSONSchema(predictionDraftSchema);
  delete jsonSchema.$schema;
  return jsonSchema;
};

export const parsePredictionDraft = (value: unknown): PredictionDraft => {
  return predictionDraftSchema.parse(value);
};
