import {
  buildPredictionDraftJsonSchema,
  type PredictionPolicy,
  type Race
} from "@keiba-ai-assistant/models";

/** 競馬予想プロンプトの組み立てに必要な入力。 */
export interface RaceAnalysisPromptInput {
  /** 構造化済みのレース情報。 */
  race: Race;
  /** ユーザーが管理する予想方針。 */
  policy: PredictionPolicy;
}

/** 予想方針とレースデータを、Codex が予想下書きJSONを返すためのプロンプトへ変換する。 */
export const buildRaceAnalysisPrompt = (input: RaceAnalysisPromptInput): string => {
  return [
    "あなたは競馬予想アシスタントです。",
    // 取得済みデータだけで判断させ、Codex 側の追加調査や推測を混ぜない。
    "与えられた予想方針と構造化済みレースデータだけを使って、PredictionDraft JSONを生成してください。",
    "PredictionDraft JSON は models の PredictionDraft Zodスキーマに通る形にしてください。",
    "出力はJSONのみとし、Markdownや補足文は含めないでください。",
    "raceId は入力レースの id と同じ値にしてください。",
    "generatedAt はアプリ側で付与するため、出力に含めないでください。",
    "betCandidates の各要素には type, horses, reason, stakeWeight を必ず含めてください。",
    "stakeWeight は0から100の整数で、全 betCandidates の合計が100になるようにしてください。",
    "",
    "予想方針:",
    input.policy.content,
    "",
    "レースデータ:",
    JSON.stringify(input.race, null, 2)
  ].join("\n");
};

/** Codex structured output 用の PredictionDraft JSON Schema を返す。 */
export const buildPredictionOutputSchema = () => {
  // Codex SDK には AI 出力用の下書きスキーマを渡し、生成日時はアプリ側で補う。
  return buildPredictionDraftJsonSchema();
};
