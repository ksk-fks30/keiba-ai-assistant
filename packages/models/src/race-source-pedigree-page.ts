import { z } from "zod";
import { sourcePageSnapshotSchema } from "@keiba-ai-assistant/models/source-page-snapshot";

/** 血統ページが元の出走馬に対してどの関係のページかを表す。 */
export const raceSourcePedigreePageRelationSchema = z.enum(["horse", "damSire"]);

export type RaceSourcePedigreePageRelation = z.infer<typeof raceSourcePedigreePageRelationSchema>;

/** レース取得元snapshotに含める血統ページ。出走馬と血統ページの対応を表す。 */
export const raceSourcePedigreePageSchema = z.object({
  // 出走馬の馬詳細URLから読み取った馬ID。
  horseId: z.string(),
  // 出走馬名またはレースページ上のリンク文字列。
  horseName: z.string(),
  // 出走馬自身の血統ページか、母父など補完対象の血統ページかを表す。
  relation: raceSourcePedigreePageRelationSchema,
  // 血統表を含む軽量snapshot。
  page: sourcePageSnapshotSchema
});

export type RaceSourcePedigreePage = z.infer<typeof raceSourcePedigreePageSchema>;

export const parseRaceSourcePedigreePage = (value: unknown): RaceSourcePedigreePage => {
  return raceSourcePedigreePageSchema.parse(value);
};
