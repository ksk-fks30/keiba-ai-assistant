import { z } from "zod";
import { sourcePageSnapshotSchema } from "@keiba-ai-assistant/models/source-page-snapshot";

/** レース取得元snapshotモデル。レースページと各馬詳細ページの軽量snapshotをまとめて表す。 */
export const raceSourceSnapshotSchema = z.object({
  // 出走表を含むレースページのsnapshot。
  racePage: sourcePageSnapshotSchema,
  // レースページの馬リンクから順番に取得した馬詳細ページのsnapshot。
  horseDetailPages: z.array(sourcePageSnapshotSchema)
});

export type RaceSourceSnapshot = z.infer<typeof raceSourceSnapshotSchema>;

export const parseRaceSourceSnapshot = (value: unknown): RaceSourceSnapshot => {
  return raceSourceSnapshotSchema.parse(value);
};
