import { z } from "zod";

/** レース取得下書き用の血統モデル。AIが馬詳細・血統snapshotから読み取る血統情報を表す。 */
export const raceDraftPedigreeSchema = z.object({
  // 父名。不明な場合は空文字を入れる。
  sire: z.string(),
  // 母名。不明な場合は空文字を入れる。
  dam: z.string(),
  // 母父名。不明な場合は空文字を入れる。
  damSire: z.string(),
  // 父からたどる父系の系統名。不明な場合は空文字を入れる。
  sireLine: z.string(),
  // 母父からたどる父系の系統名。不明な場合は空文字を入れる。
  damSireLine: z.string(),
  // 母方をたどる牝系番号。不明な場合は空文字を入れる。
  femaleFamily: z.string(),
  // 距離、馬場、脚質、近親実績など予想判断に使う血統補足文。
  familyNotes: z.array(z.string())
});

export type RaceDraftPedigree = z.infer<typeof raceDraftPedigreeSchema>;

export const parseRaceDraftPedigree = (value: unknown): RaceDraftPedigree => {
  return raceDraftPedigreeSchema.parse(value);
};
