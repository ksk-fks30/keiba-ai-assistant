import {
  type LessonEntry,
  parsePrediction,
  parsePredictionDraft,
  type Prediction,
  type PredictionDraft,
  type PredictionPolicy,
  type Race
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
  buildPredictionOutputSchema,
  buildRaceAnalysisPrompt
} from "@keiba-ai-assistant/ai/prompts";

/** 1レース分のAI分析に必要な入力。 */
export interface AnalyzeRaceInput {
  /** 構造化済みのレース情報。 */
  race: Race;
  /** ユーザーが管理する予想方針。 */
  policy: PredictionPolicy;
  /** 予想時に参照候補として渡す承認済みLesson。 */
  lessonCandidates?: LessonEntry[] | undefined;
  /** 今回出走する騎手だけに絞ったJRA騎手リーディング参照文。 */
  jockeyLeadingReference?: string | undefined;
  /** この分析で利用する Codex モデル名。 */
  model?: string;
  /** Codex SDK 実行を待つ最大時間。未指定の場合はタイムアウトしない。 */
  timeoutMs?: number;
  /** 呼び出し元からの中断通知。 */
  signal?: AbortSignal;
  /** 予想生成時刻を返す関数。テストや再実行で日時を固定する場合に使う。 */
  now?: () => Date;
  /** テストや差し替え実行で使う AI runtime。未指定なら Codex SDK runtime を使う。 */
  runtime?: CodexJsonRuntime;
}

/** レースデータと予想方針を Codex に渡し、Prediction として検証済みの分析結果を返す。 */
export const analyzeRace = async (input: AnalyzeRaceInput): Promise<Prediction> => {
  const prompt = buildRaceAnalysisPrompt({
    race: input.race,
    policy: input.policy,
    lessonCandidates: input.lessonCandidates ?? [],
    jockeyLeadingReference: input.jockeyLeadingReference
  });
  const runtime = input.runtime ?? createCodexSdkRuntime(buildCodexSdkRuntimeOptions(input));
  const executionControl = createCodexExecutionControl({
    timeoutMs: input.timeoutMs,
    signal: input.signal,
    buildTimeoutMessage: buildTimeoutMessage,
    abortMessage: "レース予想分析を中止しました。"
  });

  // Codex には生成日時を含まない下書きを要求し、保存前にアプリ側で生成日時を付与する。
  try {
    const value = await raceWithCodexExecutionControl(
      runtime.generateJson({
        prompt,
        outputSchema: buildPredictionOutputSchema(),
        model: input.model,
        signal: executionControl.signal
      }),
      executionControl.promise
    );
    const draft = parsePredictionDraft(value);

    return buildPrediction(draft, buildGeneratedAt(input), input.lessonCandidates ?? []);
  } finally {
    executionControl.dispose();
  }
};

/** analyzeRace の入力から Codex SDK runtime の初期化オプションだけを抽出する。 */
const buildCodexSdkRuntimeOptions = (input: AnalyzeRaceInput): CodexSdkRuntimeOptions => {
  const options: CodexSdkRuntimeOptions = {};

  if (input.model !== undefined) {
    options.model = input.model;
  }

  return options;
};

/** AIの予想下書きにアプリ側の生成日時を付与し、保存用 Prediction にする。 */
const buildPrediction = (
  draft: PredictionDraft,
  generatedAt: string,
  lessonCandidates: LessonEntry[]
): Prediction => {
  assertReferencedLessonsAreCandidates(draft, lessonCandidates);
  return parsePrediction({ ...draft, generatedAt });
};

/** AIが候補外のLessonを参照していないか保存前に検証する。 */
const assertReferencedLessonsAreCandidates = (
  draft: PredictionDraft,
  lessonCandidates: LessonEntry[]
): void => {
  const candidateIds = new Set(lessonCandidates.map((lesson) => lesson.id));
  const unknownReferences = draft.referencedLessons.filter(
    (reference) => !candidateIds.has(reference.lessonId)
  );
  if (unknownReferences.length > 0) {
    throw new Error(
      `候補外のLessonが予想結果に含まれています: ${unknownReferences
        .map((reference) => reference.lessonId)
        .join(", ")}`
    );
  }
};

/** 分析結果に記録する生成日時をISO 8601文字列で作る。 */
const buildGeneratedAt = (input: AnalyzeRaceInput): string => {
  return (input.now?.() ?? new Date()).toISOString();
};

/** 予想分析がタイムアウトしたときに画面へ表示するメッセージを作る。 */
const buildTimeoutMessage = (timeoutMs: number): string => {
  const seconds = Math.ceil(timeoutMs / 1000);
  return `Codex SDK の予想分析が ${seconds} 秒以内に完了しませんでした。時間をおいて再実行してください。`;
};
