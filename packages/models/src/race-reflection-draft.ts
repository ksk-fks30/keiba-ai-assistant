import { z } from "zod";
import { lessonEntryDraftSchema } from "@keiba-ai-assistant/models/lesson-entry-draft";

/** レース振り返り下書きモデル。AIが生成する振り返り本文とLesson候補を表す。 */
export const raceReflectionDraftSchema = z.object({
  // AIによる振り返り本文。
  summary: z.string(),
  // 今後の予想に活かすためDBへdraft保存するLesson候補。
  lessons: z.array(lessonEntryDraftSchema)
});

export type RaceReflectionDraft = z.infer<typeof raceReflectionDraftSchema>;

/** RaceReflectionDraft ZodスキーマからJSON Schemaを生成する。 */
export const buildRaceReflectionDraftJsonSchema = (): unknown => {
  const jsonSchema = z.toJSONSchema(raceReflectionDraftSchema);
  delete jsonSchema.$schema;
  return jsonSchema;
};

export const parseRaceReflectionDraft = (value: unknown): RaceReflectionDraft => {
  return raceReflectionDraftSchema.parse(value);
};
