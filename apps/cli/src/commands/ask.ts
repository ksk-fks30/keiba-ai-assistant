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

/** qa-history コマンドが受け取る CLI オプション。 */
interface QaHistoryCommandOptions {
  /** 履歴表示対象の race id。 */
  raceId?: string | undefined;
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

const displayTimeZone = "Asia/Tokyo";

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: displayTimeZone,
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

/** 保存済みレース分析に対する追加質問を実行し、回答を qa.jsonl に追記する CLI コマンドを登録する。 */
export const registerAskCommand = (
  program: Command,
  dependencies: AskCommandDependencies = {}
): void => {
  const deps = buildAskCommandDependencies(dependencies);

  program
    .command("ask")
    .description("Ask a follow-up question about a race")
    .argument("[raceId]", "Race ID")
    .argument("[question...]", "Question")
    .option("--race-id <raceId>", "Race ID")
    .option("--model <model>", "Codex model")
    .option("--policy-dir <path>", "Prediction policy directory path")
    .option("--policy-path <path>", "Prediction policy file path (compatibility)")
    .option("--runs-dir <path>", "Runs root directory")
    .action(
      async (
        raceIdOrQuestion: string | undefined,
        questionParts: string[],
        options: AskCommandOptions
      ) => {
        const input = resolveAskCommandInput(raceIdOrQuestion, questionParts, options);
        const runStoreOptions = buildRunStoreOptions(options);
        deps.log(`保存済みレースを読み込んでいます: ${input.raceId}`);
        const [race, prediction, history, policy] = await Promise.all([
          deps.readRace(input.raceId, runStoreOptions),
          deps.readPrediction(input.raceId, runStoreOptions),
          deps.readQaEntries(input.raceId, runStoreOptions),
          deps.readPredictionPolicy(buildPolicyStoreOptions(options))
        ]);
        deps.log(`Codexで追加質問に回答しています: ${input.question}`);
        const entry = await deps.askRace(
          buildAskRaceInput({
            race,
            prediction,
            policy,
            history,
            question: input.question,
            options
          })
        );
        deps.log("qa.jsonl に回答を追記しています。");
        await deps.appendQaEntry(entry, runStoreOptions);
        deps.log(entry.answer);
        deps.log(`qa.jsonl に追記しました: ${entry.id}`);
      }
    );
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
    .argument("[raceId]", "Race ID")
    .option("--race-id <raceId>", "Race ID")
    .option("--runs-dir <path>", "Runs root directory")
    .action(async (raceId: string | undefined, options: QaHistoryCommandOptions) => {
      const resolvedRaceId = resolveRaceId(raceId, options);
      const entries = await deps.readQaEntries(resolvedRaceId, buildRunStoreOptions(options));
      deps.log(formatQaHistory(resolvedRaceId, entries));
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

interface ResolvedAskCommandInput {
  /** 追加質問対象の race id。 */
  raceId: string;
  /** Codexへ渡す質問本文。 */
  question: string;
}

/** ask の位置引数と互換オプションから race ID と質問本文を決める。 */
const resolveAskCommandInput = (
  raceIdOrQuestion: string | undefined,
  questionParts: string[],
  options: AskCommandOptions
): ResolvedAskCommandInput => {
  if (options.raceId !== undefined) {
    const question = [raceIdOrQuestion, ...questionParts].filter(isNonEmptyText).join(" ");
    if (question.length === 0) {
      throw new Error(
        "質問を指定してください。例: pnpm keiba:cli ask --race-id <race-id> <question>"
      );
    }

    return { raceId: options.raceId, question };
  }

  if (raceIdOrQuestion === undefined) {
    throw new Error(
      "race ID と質問を指定してください。例: pnpm keiba:cli ask <race-id> <question>"
    );
  }
  if (questionParts.length === 0) {
    throw new Error("質問を指定してください。例: pnpm keiba:cli ask <race-id> <question>");
  }

  return {
    raceId: raceIdOrQuestion,
    question: questionParts.join(" ")
  };
};

/** 位置引数と互換オプションからQ&A履歴対象race IDを決める。 */
const resolveRaceId = (raceId: string | undefined, options: QaHistoryCommandOptions): string => {
  if (raceId !== undefined && options.raceId !== undefined && raceId !== options.raceId) {
    throw new Error("race ID は位置引数または --race-id のどちらか一方で指定してください。");
  }
  if (raceId !== undefined) {
    return raceId;
  }
  if (options.raceId !== undefined) {
    return options.raceId;
  }

  throw new Error("race ID を指定してください。例: pnpm keiba:cli qa-history <race-id>");
};

/** 空ではない文字列かどうかを判定する。 */
const isNonEmptyText = (value: string | undefined): value is string => {
  return value !== undefined && value.length > 0;
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

/** CLI オプションから予想方針の読み込み設定を組み立てる。 */
const buildPolicyStoreOptions = (options: AskCommandOptions): PolicyStoreOptions => {
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
      [
        `[${index + 1}] ${formatDateTime(entry.createdAt)}`,
        `Q: ${entry.question}`,
        `A: ${entry.answer}`
      ].join("\n")
    )
  ].join("\n\n");
};

/** 日時文字列を YY/mm/dd HH:mm の表示へ変換する。 */
const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = readDatePartValues(dateTimeFormatter, date);
  const { year, month, day, hour, minute } = parts;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    return value;
  }

  return `${year}/${month}/${day} ${hour}:${minute}`;
};

/** Intl.DateTimeFormat の parts を固定キーで参照できる形に変換する。 */
const readDatePartValues = (formatter: Intl.DateTimeFormat, date: Date): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return values;
};
