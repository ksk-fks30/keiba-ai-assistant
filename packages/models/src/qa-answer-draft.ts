import { z } from "zod";

/** Q&A回答下書きモデル。AIが生成する回答本文だけを表す。 */
export const qaAnswerDraftSchema = z.object({
  // ユーザーの追加質問に対するAI回答。
  answer: z.string()
});

export type QaAnswerDraft = z.infer<typeof qaAnswerDraftSchema>;

/** QaAnswerDraft ZodスキーマからJSON Schemaを生成する。 */
export const buildQaAnswerDraftJsonSchema = (): unknown => {
  const jsonSchema = z.toJSONSchema(qaAnswerDraftSchema);
  delete jsonSchema.$schema;
  return jsonSchema;
};

export const parseQaAnswerDraft = (value: unknown): QaAnswerDraft => {
  return qaAnswerDraftSchema.parse(value);
};
