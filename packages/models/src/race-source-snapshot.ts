import { z } from "zod";
import { raceSourcePedigreePageSchema } from "@keiba-ai-assistant/models/race-source-pedigree-page";
import { sourcePageSnapshotSchema } from "@keiba-ai-assistant/models/source-page-snapshot";

/** レース取得元snapshotモデル。レースページ、各馬詳細ページ、血統ページの軽量snapshotをまとめて表す。 */
export const raceSourceSnapshotSchema = z.object({
  // 出走表を含むレースページのsnapshot。
  racePage: sourcePageSnapshotSchema,
  // レースページの馬リンクから順番に取得した馬詳細ページのsnapshot。
  horseDetailPages: z.array(sourcePageSnapshotSchema),
  // 馬詳細ページから遷移して取得した血統ページのsnapshot。
  pedigreePages: z.array(raceSourcePedigreePageSchema).default([])
});

export type RaceSourceSnapshot = z.infer<typeof raceSourceSnapshotSchema>;

export const parseRaceSourceSnapshot = (value: unknown): RaceSourceSnapshot => {
  return raceSourceSnapshotSchema.parse(value);
};
