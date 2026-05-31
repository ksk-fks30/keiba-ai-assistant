import {
  parsePrediction,
  type Prediction,
  type PredictionPolicy,
  type Race
} from "@keiba-ai-assistant/models";
import { createCodexSdkRuntime, type CodexRaceAnalysisRuntime } from "@keiba-ai-assistant/ai/codex";
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
  /** この分析で利用する Codex モデル名。 */
  model?: string;
  /** テストや差し替え実行で使う AI runtime。未指定なら Codex SDK runtime を使う。 */
  runtime?: CodexRaceAnalysisRuntime;
}

/** レースデータと予想方針を Codex に渡し、Prediction として検証済みの分析結果を返す。 */
export const analyzeRace = async (input: AnalyzeRaceInput): Promise<Prediction> => {
  const prompt = buildRaceAnalysisPrompt({ race: input.race, policy: input.policy });
  const runtime = input.runtime ?? createCodexSdkRuntime({ model: input.model });

  // Codex には Prediction 形状の出力を要求し、返却値は保存前に Zod で再検証する。
  const value = await runtime.generatePrediction({
    prompt,
    outputSchema: buildPredictionOutputSchema(),
    model: input.model
  });

  return parsePrediction(value);
};
