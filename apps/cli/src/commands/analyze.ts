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
  raceId?: string | undefined;
  /** Codex SDK に渡すモデル名。 */
  model?: string | undefined;
  /** 予想方針ディレクトリのパス。 */
  policyDir?: string | undefined;
  /** 互換用の予想方針ファイルのパス。 */
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
    .argument("[raceId]", "Race ID")
    .option("--race-id <raceId>", "Race ID")
    .option("--model <model>", "Codex model")
    .option("--policy-dir <path>", "Prediction policy directory path")
    .option("--policy-path <path>", "Prediction policy file path (compatibility)")
    .option("--runs-dir <path>", "Runs root directory")
    .action(async (raceId: string | undefined, options: AnalyzeCommandOptions) => {
      // 分析は保存済み run と予想方針を入力にし、Codex にはファイル取得を任せない。
      const resolvedRaceId = resolveRaceId(raceId, options);
      const runStoreOptions = buildRunStoreOptions(options);
      deps.log(`保存済みレースを読み込んでいます: ${resolvedRaceId}`);
      const race = await deps.readRace(resolvedRaceId, runStoreOptions);
      deps.log("予想方針を読み込んでいます。");
      const policy = await deps.readPredictionPolicy(buildPolicyStoreOptions(options));
      deps.log("Codexで予想分析を実行しています。");
      const prediction = await deps.analyzeRace(buildAnalyzeRaceInput(race, policy, options));
      deps.log("prediction.json を保存しています。");
      await deps.writePrediction(prediction, runStoreOptions);
      deps.log(`prediction.json を保存しました: ${prediction.raceId}`);
    });
};

/** 位置引数と互換オプションから分析対象race IDを決める。 */
const resolveRaceId = (raceId: string | undefined, options: AnalyzeCommandOptions): string => {
  if (raceId !== undefined && options.raceId !== undefined && raceId !== options.raceId) {
    throw new Error("race ID は位置引数または --race-id のどちらか一方で指定してください。");
  }
  if (raceId !== undefined) {
    return raceId;
  }
  if (options.raceId !== undefined) {
    return options.raceId;
  }

  throw new Error("race ID を指定してください。例: pnpm keiba:cli analyze <race-id>");
};

/** CLI オプションから run store の読み書き設定を組み立てる。 */
const buildRunStoreOptions = (options: AnalyzeCommandOptions): RunStoreOptions => {
  if (options.runsDir === undefined) {
    return {};
  }

  return { rootDir: options.runsDir };
};

/** CLI オプションから予想方針の読み込み設定を組み立てる。 */
const buildPolicyStoreOptions = (options: AnalyzeCommandOptions): PolicyStoreOptions => {
  if (options.policyDir !== undefined && options.policyPath !== undefined) {
    throw new Error("--policy-dir と --policy-path は同時に指定できません。");
  }
  if (options.policyDir !== undefined) {
    return { policyDir: options.policyDir };
  }
  if (options.policyPath !== undefined) {
    return { policyPath: options.policyPath };
  }

  return {};
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
