import {
  parseRaceResult,
  parseRaceResultDraft,
  type RaceResult,
  type RaceResultDraft,
  type SourcePageSnapshot
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
  buildRaceResultExtractionPrompt,
  buildRaceResultOutputSchema
} from "@keiba-ai-assistant/ai/prompts";

/** 結果ページsnapshotからRaceResultを構造化する入力。 */
export interface ExtractRaceResultFromSnapshotInput {
  /** 対象レースID。 */
  raceId: string;
  /** ブラウザ操作で取得した結果ページの軽量snapshot。 */
  snapshot: SourcePageSnapshot;
  /** この抽出で利用する Codex モデル名。 */
  model?: string;
  /** Codex SDK 実行を待つ最大時間。未指定の場合はタイムアウトしない。 */
  timeoutMs?: number;
  /** 呼び出し元からの中断通知。 */
  signal?: AbortSignal;
  /** 取得日時を差し替える関数。テストや再実行で日時を固定する場合に使う。 */
  now?: () => Date;
  /** テストや差し替え実行で使う AI runtime。未指定なら Codex SDK runtime を使う。 */
  runtime?: CodexJsonRuntime;
}

/** 結果ページsnapshotをCodexに構造化させ、保存可能なRaceResultとして検証して返す。 */
export const extractRaceResultFromSnapshot = async (
  input: ExtractRaceResultFromSnapshotInput
): Promise<RaceResult> => {
  const prompt = buildRaceResultExtractionPrompt({ snapshot: input.snapshot });
  const runtime = input.runtime ?? createCodexSdkRuntime(buildCodexSdkRuntimeOptions(input));
  const executionControl = createCodexExecutionControl({
    timeoutMs: input.timeoutMs,
    signal: input.signal,
    buildTimeoutMessage,
    abortMessage: "レース結果の構造化を中止しました。"
  });

  // Codexには結果本文だけを要求し、race ID、URL、取得日時はアプリ側で事実値を付与する。
  try {
    const value = await raceWithCodexExecutionControl(
      runtime.generateJson({
        prompt,
        outputSchema: buildRaceResultOutputSchema(),
        model: input.model,
        signal: executionControl.signal
      }),
      executionControl.promise
    );
    const draft = parseRaceResultDraft(value);

    return buildRaceResult(input, draft);
  } finally {
    executionControl.dispose();
  }
};

/** extractRaceResultFromSnapshot の入力から Codex SDK runtime の初期化オプションだけを抽出する。 */
const buildCodexSdkRuntimeOptions = (
  input: ExtractRaceResultFromSnapshotInput
): CodexSdkRuntimeOptions => {
  const options: CodexSdkRuntimeOptions = {};

  if (input.model !== undefined) {
    options.model = input.model;
  }

  return options;
};

/** AIの結果下書きにブラウザ取得由来のメタ情報を付与し、保存用RaceResultにする。 */
const buildRaceResult = (
  input: ExtractRaceResultFromSnapshotInput,
  draft: RaceResultDraft
): RaceResult => {
  return parseRaceResult({
    raceId: input.raceId,
    sourceUrl: input.snapshot.sourceUrl,
    collectedAt: (input.now?.() ?? new Date(input.snapshot.capturedAt)).toISOString(),
    entries: draft.entries
  });
};

/** レース結果構造化がタイムアウトしたときに画面へ表示するメッセージを作る。 */
const buildTimeoutMessage = (timeoutMs: number): string => {
  const seconds = Math.ceil(timeoutMs / 1000);
  return `Codex SDK のレース結果構造化が ${seconds} 秒以内に完了しませんでした。時間をおいて再実行してください。`;
};
