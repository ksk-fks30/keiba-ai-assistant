import { z } from "zod";

/** Web上で出走馬に付与できる手動印の一覧。 */
export const horseMemoMarks = ["◎", "◯", "▲", "△", "☆", "✓", "✗"] as const;

/** Web上で出走馬に付与できる手動印を検証するschema。 */
export const horseMemoMarkSchema = z.enum(horseMemoMarks);

/** Web上で出走馬に付与する手動印。 */
export type HorseMemoMark = z.infer<typeof horseMemoMarkSchema>;

/** Web限定で保存する出走馬メモ。手動印と短いテキストメモを1頭ごとに保持する。 */
export const horseMemoSchema = z.object({
  // メモ対象のレースID。
  raceId: z.string(),
  // メモ対象の馬ID。
  horseId: z.string(),
  // ユーザーがWeb上で付けた手動印。未選択の場合はnull。
  mark: horseMemoMarkSchema.nullable(),
  // ユーザーがWeb上で入力した出走馬ごとの短いメモ。
  note: z.string(),
  // メモを作成した日時。
  createdAt: z.string(),
  // メモを最後に更新した日時。
  updatedAt: z.string()
});

export type HorseMemo = z.infer<typeof horseMemoSchema>;

export const parseHorseMemo = (value: unknown): HorseMemo => {
  return horseMemoSchema.parse(value);
};
