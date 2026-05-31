import type { Command } from "commander";
import { askRace, type AskRaceInput } from "@keiba-ai-assistant/ai";
import type { QaEntry } from "@keiba-ai-assistant/models";
import {
  appendQaEntry,
  readPrediction,
  readPredictionPolicy,
  readQaEntries,
  readRace,
  type PolicyStoreOptions,
  type RunStoreOptions
} from "@keiba-ai-assistant/storage";

/** ask コマンドが受け取る CLI オプション。 */
interface AskCommandOptions {
  /** 追加質問対象の race id。 */
  raceId: string;
  /** Codex SDK に渡すモデル名。 */
  model?: string | undefined;
  /** 予想方針ファイルのパス。 */
  policyPath?: string | undefined;
  /** runs ディレクトリのルートパス。 */
  runsDir?: string | undefined;
}

/** qa-history コマンドが受け取る CLI オプション。 */
interface QaHistoryCommandOptions {
  /** 履歴表示対象の race id。 */
  raceId: string;
  /** runs ディレクトリのルートパス。 */
  runsDir?: string | undefined;
}

/** ask / qa-history コマンドのテスト差し替え用依存関係。 */
export interface AskCommandDependencies {
  /** 追加質問を実行する関数。 */
  askRace?: ((input: AskRaceInput) => Promise<QaEntry>) | undefined;
  /** Q&A履歴を追記する関数。 */
  appendQaEntry?: typeof appendQaEntry | undefined;
  /** 予想方針を読み込む関数。 */
  readPredictionPolicy?: typeof readPredictionPolicy | undefined;
  /** 保存済み予想を読み込む関数。 */
  readPrediction?: typeof readPrediction | undefined;
  /** 保存済みQ&A履歴を読み込む関数。 */
  readQaEntries?: typeof readQaEntries | undefined;
  /** 保存済みレース情報を読み込む関数。 */
  readRace?: typeof readRace | undefined;
  /** CLI にメッセージを出力する関数。 */
  log?: ((message: string) => void) | undefined;
}

/** 保存済みレース分析に対する追加質問を実行し、回答を qa.jsonl に追記する CLI コマンドを登録する。 */
export const registerAskCommand = (
  program: Command,
  dependencies: AskCommandDependencies = {}
): void => {
  const deps = buildAskCommandDependencies(dependencies);

  program
    .command("ask")
    .description("Ask a follow-up question about a race")
    .requiredOption("--race-id <raceId>", "Race ID")
    .option("--model <model>", "Codex model")
    .option("--policy-path <path>", "Prediction policy file path")
    .option("--runs-dir <path>", "Runs root directory")
    .argument("<question>", "Question")
    .action(async (question: string, options: AskCommandOptions) => {
      const runStoreOptions = buildRunStoreOptions(options);
      const [race, prediction, history, policy] = await Promise.all([
        deps.readRace(options.raceId, runStoreOptions),
        deps.readPrediction(options.raceId, runStoreOptions),
        deps.readQaEntries(options.raceId, runStoreOptions),
        deps.readPredictionPolicy(buildPolicyStoreOptions(options))
      ]);
      const entry = await deps.askRace(
        buildAskRaceInput({ race, prediction, policy, history, question, options })
      );
      await deps.appendQaEntry(entry, runStoreOptions);
      deps.log(entry.answer);
      deps.log(`qa.jsonl に追記しました: ${entry.id}`);
    });
};

/** 保存済みQ&A履歴をターミナルで確認する CLI コマンドを登録する。 */
export const registerQaHistoryCommand = (
  program: Command,
  dependencies: AskCommandDependencies = {}
): void => {
  const deps = buildAskCommandDependencies(dependencies);

  program
    .command("qa-history")
    .description("Show follow-up Q&A history about a race")
    .requiredOption("--race-id <raceId>", "Race ID")
    .option("--runs-dir <path>", "Runs root directory")
    .action(async (options: QaHistoryCommandOptions) => {
      const entries = await deps.readQaEntries(options.raceId, buildRunStoreOptions(options));
      deps.log(formatQaHistory(options.raceId, entries));
    });
};

/** テスト差し替え用依存関係と本実装を合成する。 */
const buildAskCommandDependencies = (dependencies: AskCommandDependencies) => {
  return {
    askRace: dependencies.askRace ?? askRace,
    appendQaEntry: dependencies.appendQaEntry ?? appendQaEntry,
    readPrediction: dependencies.readPrediction ?? readPrediction,
    readPredictionPolicy: dependencies.readPredictionPolicy ?? readPredictionPolicy,
    readQaEntries: dependencies.readQaEntries ?? readQaEntries,
    readRace: dependencies.readRace ?? readRace,
    log: dependencies.log ?? console.log
  };
};

/** CLI オプションから run store の読み書き設定を組み立てる。 */
const buildRunStoreOptions = (
  options: AskCommandOptions | QaHistoryCommandOptions
): RunStoreOptions => {
  if (options.runsDir === undefined) {
    return {};
  }

  return { rootDir: options.runsDir };
};

/** CLI オプションから予想方針ファイルの読み込み設定を組み立てる。 */
const buildPolicyStoreOptions = (options: AskCommandOptions): PolicyStoreOptions => {
  if (options.policyPath === undefined) {
    return {};
  }

  return { policyPath: options.policyPath };
};

/** CLI入力と保存済みデータを AI 追加質問パッケージの入力形式へ変換する。 */
const buildAskRaceInput = (input: {
  race: Awaited<ReturnType<typeof readRace>>;
  prediction: Awaited<ReturnType<typeof readPrediction>>;
  policy: Awaited<ReturnType<typeof readPredictionPolicy>>;
  history: Awaited<ReturnType<typeof readQaEntries>>;
  question: string;
  options: AskCommandOptions;
}): AskRaceInput => {
  if (input.options.model === undefined) {
    return {
      race: input.race,
      prediction: input.prediction,
      policy: input.policy,
      history: input.history,
      question: input.question
    };
  }

  return {
    race: input.race,
    prediction: input.prediction,
    policy: input.policy,
    history: input.history,
    question: input.question,
    model: input.options.model
  };
};

/** Q&A履歴をターミナルで読みやすい文字列に整形する。 */
const formatQaHistory = (raceId: string, entries: QaEntry[]): string => {
  if (entries.length === 0) {
    return `Q&A履歴はありません: ${raceId}`;
  }

  return [
    `Q&A履歴: ${raceId}`,
    ...entries.map((entry, index) =>
      [`[${index + 1}] ${entry.createdAt}`, `Q: ${entry.question}`, `A: ${entry.answer}`].join("\n")
    )
  ].join("\n\n");
};
