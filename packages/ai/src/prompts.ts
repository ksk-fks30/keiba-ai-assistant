import {
  buildPredictionDraftJsonSchema,
  buildQaAnswerDraftJsonSchema,
  type Prediction,
  type PredictionPolicy,
  type QaEntry,
  type Race
} from "@keiba-ai-assistant/models";

/** 競馬予想プロンプトの組み立てに必要な入力。 */
export interface RaceAnalysisPromptInput {
  /** 構造化済みのレース情報。 */
  race: Race;
  /** ユーザーが管理する予想方針。 */
  policy: PredictionPolicy;
}

/** 追加質問プロンプトの組み立てに必要な入力。 */
export interface RaceQuestionPromptInput {
  /** 構造化済みのレース情報。 */
  race: Race;
  /** 保存済みの予想結果。 */
  prediction: Prediction;
  /** ユーザーが管理する予想方針。 */
  policy: PredictionPolicy;
  /** 同じレースに対する過去のQ&A履歴。 */
  history: QaEntry[];
  /** 今回の追加質問。 */
  question: string;
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

/** 保存済み分析結果とQ&A履歴を、Codex が回答下書きJSONを返すためのプロンプトへ変換する。 */
export const buildRaceQuestionPrompt = (input: RaceQuestionPromptInput): string => {
  return [
    "あなたは競馬予想アシスタントです。",
    // 追加質問では保存済みデータだけを参照し、外部調査や推測の混入を防ぐ。
    "与えられた予想方針、構造化済みレースデータ、保存済み予想結果、過去のQ&A履歴だけを使って、QaAnswerDraft JSONを生成してください。",
    "QaAnswerDraft JSON は models の QaAnswerDraft Zodスキーマに通る形にしてください。",
    "出力はJSONのみとし、Markdownや補足文は含めないでください。",
    "id, raceId, question, createdAt はアプリ側で付与するため、出力に含めないでください。",
    "answer では質問に直接答え、必要に応じて保存済み予想の根拠やリスクを参照してください。",
    'answer には回答本文だけを入れ、JSON文字列や {"answer": "..."} のような文字列は入れないでください。',
    "",
    "予想方針:",
    input.policy.content,
    "",
    "レースデータ:",
    JSON.stringify(input.race, null, 2),
    "",
    "保存済み予想結果:",
    JSON.stringify(input.prediction, null, 2),
    "",
    "過去のQ&A履歴:",
    JSON.stringify(input.history, null, 2),
    "",
    "今回の質問:",
    input.question
  ].join("\n");
};

/** Codex structured output 用の PredictionDraft JSON Schema を返す。 */
export const buildPredictionOutputSchema = () => {
  // Codex SDK には AI 出力用の下書きスキーマを渡し、生成日時はアプリ側で補う。
  return buildPredictionDraftJsonSchema();
};

/** Codex structured output 用の QaAnswerDraft JSON Schema を返す。 */
export const buildQaAnswerOutputSchema = () => {
  // Q&A回答のメタ情報はアプリ側で補い、AIには回答本文だけを要求する。
  return buildQaAnswerDraftJsonSchema();
};
