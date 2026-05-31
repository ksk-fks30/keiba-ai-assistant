import {
  parseQaAnswerDraft,
  parseQaEntry,
  type Prediction,
  type PredictionPolicy,
  type QaEntry,
  type Race
} from "@keiba-ai-assistant/models";
import {
  createCodexSdkRuntime,
  type CodexJsonRuntime,
  type CodexSdkRuntimeOptions
} from "@keiba-ai-assistant/ai/codex";
import { buildQaAnswerOutputSchema, buildRaceQuestionPrompt } from "@keiba-ai-assistant/ai/prompts";

/** 1レース分の追加質問に必要な入力。 */
export interface AskRaceInput {
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
  /** この質問で利用する Codex モデル名。 */
  model?: string;
  /** Q&A作成時刻を返す関数。テストや再実行で日時を固定する場合に使う。 */
  now?: () => Date;
  /** テストや差し替え実行で使う AI runtime。未指定なら Codex SDK runtime を使う。 */
  runtime?: CodexJsonRuntime;
}

/** 保存済みレース分析に対する追加質問を Codex に渡し、保存用 QaEntry を返す。 */
export const askRace = async (input: AskRaceInput): Promise<QaEntry> => {
  const prompt = buildRaceQuestionPrompt({
    race: input.race,
    prediction: input.prediction,
    policy: input.policy,
    history: input.history,
    question: input.question
  });
  const runtime = input.runtime ?? createCodexSdkRuntime(buildCodexSdkRuntimeOptions(input));

  // Codex には回答本文だけを要求し、Q&Aの識別情報はアプリ側で付与する。
  const value = await runtime.generateJson({
    prompt,
    outputSchema: buildQaAnswerOutputSchema(),
    model: input.model
  });
  const draft = parseQaAnswerDraft(value);

  return buildQaEntry(input, normalizeAnswer(draft.answer));
};

/** askRace の入力から Codex SDK runtime の初期化オプションだけを抽出する。 */
const buildCodexSdkRuntimeOptions = (input: AskRaceInput): CodexSdkRuntimeOptions => {
  const options: CodexSdkRuntimeOptions = {};

  if (input.model !== undefined) {
    options.model = input.model;
  }

  return options;
};

/** AIが answer 内にJSON文字列を入れた場合でも、保存前に回答本文へ正規化する。 */
const normalizeAnswer = (answer: string): string => {
  const trimmedAnswer = answer.trim();
  try {
    const value = JSON.parse(trimmedAnswer) as unknown;
    const draft = parseQaAnswerDraft(value);
    return draft.answer;
  } catch {
    return answer;
  }
};

/** AIの回答下書きにアプリ側のQ&Aメタ情報を付与し、保存用 QaEntry にする。 */
const buildQaEntry = (input: AskRaceInput, answer: string): QaEntry => {
  const createdAt = buildCreatedAt(input);

  return parseQaEntry({
    id: buildQaEntryId(input, createdAt),
    raceId: input.race.id,
    question: input.question,
    answer,
    createdAt
  });
};

/** Q&A履歴内で安定して参照できるIDを作る。 */
const buildQaEntryId = (input: AskRaceInput, createdAt: string): string => {
  const sequence = String(input.history.length + 1).padStart(4, "0");
  const timestamp = createdAt.replaceAll(/\D/g, "");
  return `qa-${sequence}-${timestamp}`;
};

/** Q&Aに記録する作成日時をISO 8601文字列で作る。 */
const buildCreatedAt = (input: AskRaceInput): string => {
  return (input.now?.() ?? new Date()).toISOString();
};
