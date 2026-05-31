import { z } from "zod";
import { raceDraftHorseSchema } from "@keiba-ai-assistant/models/race-draft-horse";
import { raceSurfaceSchema } from "@keiba-ai-assistant/models/race-surface";

/** レース取得下書きモデル。AIがページsnapshotから生成する、保存メタ情報を含まない基本レース情報を表す。 */
export const raceDraftSchema = z.object({
  // データ取得元URLから安定して参照できるレースID。
  id: z.string().min(1),
  // レース名。
  name: z.string().min(1),
  // 競馬場名。
  racecourse: z.string().min(1),
  // 馬場種別。
  surface: raceSurfaceSchema,
  // レース距離。メートル単位。
  distanceMeters: z.number().int().positive(),
  // 出走馬一覧。
  horses: z.array(raceDraftHorseSchema).min(1)
});

export type RaceDraft = z.infer<typeof raceDraftSchema>;

/** RaceDraft ZodスキーマからJSON Schemaを生成する。 */
export const buildRaceDraftJsonSchema = (): unknown => {
  const jsonSchema = z.toJSONSchema(raceDraftSchema);
  delete jsonSchema.$schema;
  return jsonSchema;
};

export const parseRaceDraft = (value: unknown): RaceDraft => {
  return raceDraftSchema.parse(value);
};
