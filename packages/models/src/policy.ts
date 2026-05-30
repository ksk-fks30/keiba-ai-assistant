import { z } from "zod";

/** 予想方針モデル。分析に渡すユーザー定義方針の本文と読込情報を表す。 */
export const predictionPolicySchema = z.object({
  // 予想方針を読み込んだローカルファイルパス。
  path: z.string(),
  // 予想判断に使う方針本文。
  content: z.string(),
  // 方針を読み込んだ日時。
  loadedAt: z.string()
});

export type PredictionPolicy = z.infer<typeof predictionPolicySchema>;

export function parsePredictionPolicy(value: unknown): PredictionPolicy {
  return predictionPolicySchema.parse(value);
}
