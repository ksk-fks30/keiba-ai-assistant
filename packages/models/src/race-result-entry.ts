import { z } from "zod";

/** レース結果の1頭分。結果ページから読み取れる着順、馬、払戻前の基本情報を表す。 */
export const raceResultEntrySchema = z.object({
  // 結果表に表示される着順。中止、除外などの非数値表記もそのまま扱う。
  rank: z.string(),
  // 馬番。読み取れない場合はnullにする。
  horseNumber: z.number().int().positive().nullable(),
  // 馬名。
  horseName: z.string(),
  // 騎手名。読み取れない場合は空文字にする。
  jockey: z.string(),
  // 人気順。読み取れない場合はnullにする。
  popularity: z.number().int().positive().nullable(),
  // 単勝オッズ。読み取れない場合はnullにする。
  odds: z.number().positive().nullable(),
  // 走破時計。読み取れない場合は空文字にする。
  time: z.string(),
  // 着差。読み取れない場合は空文字にする。
  margin: z.string()
});

export type RaceResultEntry = z.infer<typeof raceResultEntrySchema>;

export const parseRaceResultEntry = (value: unknown): RaceResultEntry => {
  return raceResultEntrySchema.parse(value);
};
