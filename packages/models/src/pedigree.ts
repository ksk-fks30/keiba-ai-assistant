import { z } from "zod";

/** 血統モデル。父、母、母父、系統と血統上の補足情報を表す。 */
export const pedigreeSchema = z.object({
  // 父名。
  sire: z.string().optional(),
  // 母名。
  dam: z.string().optional(),
  // 母父名。
  damSire: z.string().optional(),
  // 父からたどる父系の系統名。例: サンデーサイレンス系。
  sireLine: z.string().optional(),
  // 母父からたどる父系の系統名。
  damSireLine: z.string().optional(),
  // 母方をたどる牝系番号。例: FNo.[11-d]。
  femaleFamily: z.string().optional(),
  // 距離、馬場、脚質、近親実績など予想判断に使う血統補足文。
  familyNotes: z.array(z.string()).default([])
});

export type Pedigree = z.infer<typeof pedigreeSchema>;

export const parsePedigree = (value: unknown): Pedigree => {
  return pedigreeSchema.parse(value);
};
