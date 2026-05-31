import type { Command } from "commander";
import { analyzeRace, type AnalyzeRaceInput } from "@keiba-ai-assistant/ai";
import type { Prediction } from "@keiba-ai-assistant/models";
import {
  readPredictionPolicy,
  readRace,
  writePrediction,
  type PolicyStoreOptions,
  type RunStoreOptions
} from "@keiba-ai-assistant/storage";

/** analyze コマンドが受け取る CLI オプション。 */
interface AnalyzeCommandOptions {
  /** 分析対象の race id。 */
  raceId: string;
  /** Codex SDK に渡すモデル名。 */
  model?: string | undefined;
  /** 予想方針ファイルのパス。 */
  policyPath?: string | undefined;
  /** runs ディレクトリのルートパス。 */
  runsDir?: string | undefined;
}

/** analyze コマンドのテスト差し替え用依存関係。 */
export interface AnalyzeCommandDependencies {
  /** レース分析を実行する関数。 */
  analyzeRace?: ((input: AnalyzeRaceInput) => Promise<Prediction>) | undefined;
  /** 予想方針を読み込む関数。 */
  readPredictionPolicy?: typeof readPredictionPolicy | undefined;
  /** 保存済みレース情報を読み込む関数。 */
  readRace?: typeof readRace | undefined;
  /** 分析結果を保存する関数。 */
  writePrediction?: typeof writePrediction | undefined;
  /** CLI にメッセージを出力する関数。 */
  log?: ((message: string) => void) | undefined;
}

/** 保存済みレースを読み込み、Codex 分析結果を prediction.json として保存する CLI コマンドを登録する。 */
export const registerAnalyzeCommand = (
  program: Command,
  dependencies: AnalyzeCommandDependencies = {}
): void => {
  // テストでは依存関係を差し替え、通常実行では実装をそのまま使う。
  const deps = {
    analyzeRace: dependencies.analyzeRace ?? analyzeRace,
    readPredictionPolicy: dependencies.readPredictionPolicy ?? readPredictionPolicy,
    readRace: dependencies.readRace ?? readRace,
    writePrediction: dependencies.writePrediction ?? writePrediction,
    log: dependencies.log ?? console.log
  };

  program
    .command("analyze")
    .description("Analyze a collected race")
    .requiredOption("--race-id <raceId>", "Race ID")
    .option("--model <model>", "Codex model")
    .option("--policy-path <path>", "Prediction policy file path")
    .option("--runs-dir <path>", "Runs root directory")
    .action(async (options: AnalyzeCommandOptions) => {
      // 分析は保存済み run と予想方針を入力にし、Codex にはファイル取得を任せない。
      const runStoreOptions = buildRunStoreOptions(options);
      const race = await deps.readRace(options.raceId, runStoreOptions);
      const policy = await deps.readPredictionPolicy(buildPolicyStoreOptions(options));
      const prediction = await deps.analyzeRace(buildAnalyzeRaceInput(race, policy, options));
      await deps.writePrediction(prediction, runStoreOptions);
      deps.log(`prediction.json を保存しました: ${prediction.raceId}`);
    });
};

/** CLI オプションから run store の読み書き設定を組み立てる。 */
const buildRunStoreOptions = (options: AnalyzeCommandOptions): RunStoreOptions => {
  if (options.runsDir === undefined) {
    return {};
  }

  return { rootDir: options.runsDir };
};

/** CLI オプションから予想方針ファイルの読み込み設定を組み立てる。 */
const buildPolicyStoreOptions = (options: AnalyzeCommandOptions): PolicyStoreOptions => {
  if (options.policyPath === undefined) {
    return {};
  }

  return { policyPath: options.policyPath };
};

/** CLI オプションを AI 分析パッケージの入力形式へ変換する。 */
const buildAnalyzeRaceInput = (
  race: Awaited<ReturnType<typeof readRace>>,
  policy: Awaited<ReturnType<typeof readPredictionPolicy>>,
  options: AnalyzeCommandOptions
) => {
  if (options.model === undefined) {
    return { race, policy };
  }

  return { race, policy, model: options.model };
};
