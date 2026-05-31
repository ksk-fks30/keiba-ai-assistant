import { z } from "zod";

/** レース取得下書き用の血統モデル。AIが馬詳細snapshotから読み取る血統情報を表す。 */
export const raceDraftPedigreeSchema = z.object({
  // 父名。不明な場合は空文字を入れる。
  sire: z.string(),
  // 母名。不明な場合は空文字を入れる。
  dam: z.string(),
  // 母父名。不明な場合は空文字を入れる。
  damSire: z.string(),
  // 距離や馬場適性の判断に使う血統メモ。
  familyNotes: z.array(z.string())
});

export type RaceDraftPedigree = z.infer<typeof raceDraftPedigreeSchema>;

export const parseRaceDraftPedigree = (value: unknown): RaceDraftPedigree => {
  return raceDraftPedigreeSchema.parse(value);
};
