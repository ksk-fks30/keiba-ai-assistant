import { z } from "zod";
import { raceResultSchema } from "@keiba-ai-assistant/models/race-result";

/** レース結果下書きモデル。AIが生成する、取得元メタ情報を含まない結果本文を表す。 */
export const raceResultDraftSchema = raceResultSchema.omit({
  // 対象レースIDはアプリ側の保存済みRaceから付与する。
  raceId: true,
  // 取得元URLはブラウザsnapshotから付与する。
  sourceUrl: true,
  // 取得日時はブラウザsnapshotから付与する。
  collectedAt: true
});

export type RaceResultDraft = z.infer<typeof raceResultDraftSchema>;

/** RaceResultDraft ZodスキーマからJSON Schemaを生成する。 */
export const buildRaceResultDraftJsonSchema = (): unknown => {
  const jsonSchema = z.toJSONSchema(raceResultDraftSchema);
  delete jsonSchema.$schema;
  return jsonSchema;
};

export const parseRaceResultDraft = (value: unknown): RaceResultDraft => {
  return raceResultDraftSchema.parse(value);
};
