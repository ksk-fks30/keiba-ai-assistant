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
  /** Codex SDK 実行を待つ最大時間。未指定の場合はタイムアウトしない。 */
  timeoutMs?: number;
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
  const timeout = createAskRaceTimeout(input.timeoutMs);

  // Codex には回答本文だけを要求し、Q&Aの識別情報はアプリ側で付与する。
  try {
    const value = await raceWithTimeout(
      runtime.generateJson(buildGenerateJsonRequest({ prompt, input, signal: timeout.signal })),
      timeout.promise
    );
    const draft = parseQaAnswerDraft(value);

    return buildQaEntry(input, normalizeAnswer(draft.answer));
  } finally {
    timeout.dispose();
  }
};

/** askRace の入力から Codex SDK runtime の初期化オプションだけを抽出する。 */
const buildCodexSdkRuntimeOptions = (input: AskRaceInput): CodexSdkRuntimeOptions => {
  const options: CodexSdkRuntimeOptions = {};

  if (input.model !== undefined) {
    options.model = input.model;
  }

  return options;
};

/** Codex runtime へ渡すJSON生成リクエストを組み立てる。 */
const buildGenerateJsonRequest = (input: {
  prompt: string;
  input: AskRaceInput;
  signal: AbortSignal | undefined;
}) => {
  return {
    prompt: input.prompt,
    outputSchema: buildQaAnswerOutputSchema(),
    ...(input.input.model === undefined ? {} : { model: input.input.model }),
    ...(input.signal === undefined ? {} : { signal: input.signal })
  };
};

/** 追加質問用のタイムアウト制御を作る。 */
const createAskRaceTimeout = (
  timeoutMs: number | undefined
): {
  signal: AbortSignal | undefined;
  promise: Promise<never> | undefined;
  dispose: () => void;
} => {
  if (timeoutMs === undefined) {
    return {
      signal: undefined,
      promise: undefined,
      dispose: () => {}
    };
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs は正の有限数で指定してください。");
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      // AbortSignalを通じてCodex CLI子プロセスにも中断を伝える。
      controller.abort();
      reject(new Error(buildTimeoutMessage(timeoutMs)));
    }, timeoutMs);
  });

  return {
    signal: controller.signal,
    promise,
    dispose: () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  };
};

/** Codex SDK実行とタイムアウトを競争させ、長時間待ち続けないようにする。 */
const raceWithTimeout = async <Value>(
  promise: Promise<Value>,
  timeoutPromise: Promise<never> | undefined
): Promise<Value> => {
  if (timeoutPromise === undefined) {
    return await promise;
  }

  return await Promise.race([promise, timeoutPromise]);
};

/** 追加質問がタイムアウトしたときに画面へ表示するメッセージを作る。 */
const buildTimeoutMessage = (timeoutMs: number): string => {
  const seconds = Math.ceil(timeoutMs / 1000);
  return `Codex SDK の追加質問が ${seconds} 秒以内に完了しませんでした。時間をおいて再実行してください。`;
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
