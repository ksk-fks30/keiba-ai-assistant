import type { PredictionPolicy, Race } from "@keiba-ai-assistant/models";

/** 競馬予想プロンプトの組み立てに必要な入力。 */
export interface RaceAnalysisPromptInput {
  /** 構造化済みのレース情報。 */
  race: Race;
  /** ユーザーが管理する予想方針。 */
  policy: PredictionPolicy;
}

/** 予想方針とレースデータを、Codex が Prediction JSON を返すためのプロンプトへ変換する。 */
export const buildRaceAnalysisPrompt = (input: RaceAnalysisPromptInput): string => {
  return [
    "あなたは競馬予想アシスタントです。",
    // 取得済みデータだけで判断させ、Codex 側の追加調査や推測を混ぜない。
    "与えられた予想方針と構造化済みレースデータだけを使って、Prediction JSONを生成してください。",
    "出力はJSONのみとし、Markdownや補足文は含めないでください。",
    "raceId は入力レースの id と同じ値にしてください。",
    "generatedAt は現在時刻をISO 8601文字列で設定してください。",
    "",
    "予想方針:",
    input.policy.content,
    "",
    "レースデータ:",
    JSON.stringify(input.race, null, 2)
  ].join("\n");
};

/** Codex structured output 用の Prediction JSON Schema を返す。 */
export const buildPredictionOutputSchema = () => {
  return {
    type: "object",
    properties: {
      raceId: { type: "string" },
      summary: { type: "string" },
      evaluations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            horseId: { type: "string" },
            mark: {
              type: "string",
              enum: ["favorite", "second", "third", "longshot", "watch", "dismiss"]
            },
            score: { type: "number", minimum: 0, maximum: 100 },
            reasons: {
              type: "array",
              items: { type: "string" }
            },
            risks: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["horseId", "mark", "score", "reasons", "risks"],
          additionalProperties: false
        }
      },
      betCandidates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            horses: {
              type: "array",
              items: { type: "string" }
            },
            reason: { type: "string" },
            stakeWeight: { type: "number", minimum: 0, maximum: 100 }
          },
          required: ["type", "horses"],
          additionalProperties: false
        }
      },
      generatedAt: { type: "string" },
      model: { type: "string" }
    },
    // 保存時の最終的な正しさは models の parsePrediction で担保する。
    required: ["raceId", "summary", "evaluations", "betCandidates", "generatedAt"],
    additionalProperties: false
  } as const;
};
