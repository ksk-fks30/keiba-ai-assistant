import {
  parseRaceReflectionDraft,
  type Prediction,
  type PredictionPolicy,
  type Race,
  type RaceReflectionDraft,
  type RaceResult
} from "@keiba-ai-assistant/models";
import {
  createCodexSdkRuntime,
  type CodexJsonRuntime,
  type CodexSdkRuntimeOptions
} from "@keiba-ai-assistant/ai/codex";
import {
  createCodexExecutionControl,
  raceWithCodexExecutionControl
} from "@keiba-ai-assistant/ai/codex-timeout";
import {
  buildRaceReflectionOutputSchema,
  buildRaceReflectionPrompt
} from "@keiba-ai-assistant/ai/prompts";

/** 1レース分の振り返りに必要な入力。 */
export interface ReflectRaceInput {
  /** 構造化済みのレース情報。 */
  race: Race;
  /** 保存済みの予想結果。 */
  prediction: Prediction;
  /** 取得済みの確定レース結果。 */
  result: RaceResult;
  /** ユーザーが管理する予想方針。 */
  policy: PredictionPolicy;
  /** この振り返りで利用する Codex モデル名。 */
  model?: string;
  /** Codex SDK 実行を待つ最大時間。未指定の場合はタイムアウトしない。 */
  timeoutMs?: number;
  /** 呼び出し元からの中断通知。 */
  signal?: AbortSignal;
  /** テストや差し替え実行で使う AI runtime。未指定なら Codex SDK runtime を使う。 */
  runtime?: CodexJsonRuntime;
}

/** 保存済み予想と確定結果をCodexへ渡し、振り返り下書きとして検証して返す。 */
export const reflectRace = async (input: ReflectRaceInput): Promise<RaceReflectionDraft> => {
  const prompt = buildRaceReflectionPrompt({
    race: input.race,
    prediction: input.prediction,
    result: input.result,
    policy: input.policy
  });
  const runtime = input.runtime ?? createCodexSdkRuntime(buildCodexSdkRuntimeOptions(input));
  const executionControl = createCodexExecutionControl({
    timeoutMs: input.timeoutMs,
    signal: input.signal,
    buildTimeoutMessage,
    abortMessage: "レース振り返りを中止しました。"
  });

  // Codexには振り返り本文とLesson下書きだけを要求し、保存メタ情報はアプリ側で付与する。
  try {
    const value = await raceWithCodexExecutionControl(
      runtime.generateJson({
        prompt,
        outputSchema: buildRaceReflectionOutputSchema(),
        model: input.model,
        signal: executionControl.signal
      }),
      executionControl.promise
    );

    return parseRaceReflectionDraft(value);
  } finally {
    executionControl.dispose();
  }
};

/** reflectRace の入力から Codex SDK runtime の初期化オプションだけを抽出する。 */
const buildCodexSdkRuntimeOptions = (input: ReflectRaceInput): CodexSdkRuntimeOptions => {
  const options: CodexSdkRuntimeOptions = {};

  if (input.model !== undefined) {
    options.model = input.model;
  }

  return options;
};

/** レース振り返りがタイムアウトしたときに画面へ表示するメッセージを作る。 */
const buildTimeoutMessage = (timeoutMs: number): string => {
  const seconds = Math.ceil(timeoutMs / 1000);
  return `Codex SDK のレース振り返りが ${seconds} 秒以内に完了しませんでした。時間をおいて再実行してください。`;
};
