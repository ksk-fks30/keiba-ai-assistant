import { z } from "zod";

/** 買い目候補モデル。分析結果として提示する券種と対象馬、根拠、配分を表す。 */
export const betCandidateSchema = z.object({
  // 単勝、馬連、三連単などの券種またはローカル表記。
  type: z.string(),
  // この買い目候補に含める馬IDの一覧。
  horses: z.array(z.string()),
  // この買い目候補を提示する理由。
  reason: z.string().optional(),
  // 投資配分の相対ウェイト。0から100で表す。
  stakeWeight: z.number().min(0).max(100).optional()
});

export type BetCandidate = z.infer<typeof betCandidateSchema>;

export const parseBetCandidate = (value: unknown): BetCandidate => {
  return betCandidateSchema.parse(value);
};
