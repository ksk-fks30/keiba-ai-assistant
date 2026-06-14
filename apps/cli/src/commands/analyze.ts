import type { Command } from "commander";
import { analyzeRace, type AnalyzeRaceInput } from "@keiba-ai-assistant/ai";
import type { LessonEntry, Prediction } from "@keiba-ai-assistant/models";
import {
  buildLessonSearchInputFromRace,
  buildPredictionLessonReferences,
  recordPredictionLessonReferences,
  readJockeyLeadingReferenceForRace,
  readPredictionPolicy,
  readRace,
  searchLessonEntries,
  type LessonStoreOptions,
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
  /** Lesson SQLite DBファイルのパス。 */
  lessonDb?: string | undefined;
}

/** analyze コマンドのテスト差し替え用依存関係。 */
export interface AnalyzeCommandDependencies {
  /** レース分析を実行する関数。 */
  analyzeRace?: ((input: AnalyzeRaceInput) => Promise<Prediction>) | undefined;
  /** 予想方針を読み込む関数。 */
  readPredictionPolicy?: typeof readPredictionPolicy | undefined;
  /** 今回出走する騎手だけに絞ったJRA騎手リーディング参照文を読み込む関数。 */
  readJockeyLeadingReferenceForRace?: typeof readJockeyLeadingReferenceForRace | undefined;
  /** 保存済みレース情報を読み込む関数。 */
  readRace?: typeof readRace | undefined;
  /** 予想時に参照するLesson候補を検索する関数。 */
  searchLessonEntries?: typeof searchLessonEntries | undefined;
  /** 分析結果を保存する関数。 */
  writePrediction?: typeof writePrediction | undefined;
  /** 予想で採用したLesson参照履歴を保存する関数。 */
  recordPredictionLessonReferences?: typeof recordPredictionLessonReferences | undefined;
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
    readJockeyLeadingReferenceForRace:
      dependencies.readJockeyLeadingReferenceForRace ?? readJockeyLeadingReferenceForRace,
    readRace: dependencies.readRace ?? readRace,
    searchLessonEntries: dependencies.searchLessonEntries ?? searchLessonEntries,
    writePrediction: dependencies.writePrediction ?? writePrediction,
    recordPredictionLessonReferences:
      dependencies.recordPredictionLessonReferences ?? recordPredictionLessonReferences,
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
    .option("--lesson-db <path>", "Lesson SQLite database path")
    .action(async (raceId: string | undefined, options: AnalyzeCommandOptions) => {
      // 分析は保存済み run と予想方針を入力にし、Codex にはファイル取得を任せない。
      const resolvedRaceId = resolveRaceId(raceId, options);
      const runStoreOptions = buildRunStoreOptions(options);
      const lessonStoreOptions = buildLessonStoreOptions(options);
      deps.log(`保存済みレースを読み込んでいます: ${resolvedRaceId}`);
      const race = await deps.readRace(resolvedRaceId, runStoreOptions);
      deps.log("過去の反省Lesson候補を検索しています。");
      const lessonResults = await deps.searchLessonEntries(
        buildLessonSearchInputFromRace(race),
        lessonStoreOptions
      );
      const lessonCandidates = lessonResults.map((result) => result.lesson);
      deps.log(`Lesson候補を ${lessonCandidates.length} 件見つけました。`);
      deps.log("予想方針を読み込んでいます。");
      const policy = await deps.readPredictionPolicy(buildPolicyStoreOptions(options));
      const jockeyLeadingReference = await deps.readJockeyLeadingReferenceForRace(race);
      deps.log("Codexで予想分析を実行しています。");
      const prediction = await deps.analyzeRace(
        buildAnalyzeRaceInput(race, policy, options, lessonCandidates, jockeyLeadingReference)
      );
      deps.log("prediction.json を保存しています。");
      await deps.writePrediction(prediction, runStoreOptions);
      if (prediction.referencedLessons.length > 0) {
        deps.log("採用されたLesson参照履歴を保存しています。");
        await deps.recordPredictionLessonReferences(
          buildPredictionLessonReferences(prediction),
          lessonStoreOptions
        );
      }
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

/** CLI オプションからLesson DBの読み書き設定を組み立てる。 */
const buildLessonStoreOptions = (options: AnalyzeCommandOptions): LessonStoreOptions => {
  if (options.lessonDb === undefined) {
    return {};
  }

  return { dbPath: options.lessonDb };
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
  options: AnalyzeCommandOptions,
  lessonCandidates: LessonEntry[],
  jockeyLeadingReference: string | undefined
): AnalyzeRaceInput => {
  const input: AnalyzeRaceInput = { race, policy, lessonCandidates };
  if (options.model !== undefined) {
    input.model = options.model;
  }
  if (jockeyLeadingReference !== undefined) {
    input.jockeyLeadingReference = jockeyLeadingReference;
  }

  return input;
};
