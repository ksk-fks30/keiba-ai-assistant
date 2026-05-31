import { z } from "zod";

/** 血統モデル。父、母、母父と血統上の補足情報を表す。 */
export const pedigreeSchema = z.object({
  // 父名。
  sire: z.string().optional(),
  // 母名。
  dam: z.string().optional(),
  // 母父名。
  damSire: z.string().optional(),
  // 距離や馬場適性の判断に使う血統メモ。
  familyNotes: z.array(z.string()).default([])
});

export type Pedigree = z.infer<typeof pedigreeSchema>;

export const parsePedigree = (value: unknown): Pedigree => {
  return pedigreeSchema.parse(value);
};
