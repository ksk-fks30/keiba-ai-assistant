import { Codex, type CodexOptions, type ThreadOptions } from "@openai/codex-sdk";

/** Codex SDK に渡す競馬予想リクエスト。 */
export interface CodexRaceAnalysisRequest {
  /** Codex に渡す分析プロンプト。 */
  prompt: string;
  /** Codex の structured output として要求する JSON Schema。 */
  outputSchema: unknown;
  /** この分析だけで使う Codex モデル名。 */
  model?: string | undefined;
}

/** 競馬予想を生成する AI 実行基盤。 */
export interface CodexRaceAnalysisRuntime {
  /** プロンプトと出力スキーマから Prediction の元になる未検証値を生成する。 */
  generatePrediction: (request: CodexRaceAnalysisRequest) => Promise<unknown>;
}

/** Codex SDK runtime の初期化オプション。 */
export interface CodexSdkRuntimeOptions {
  /** Codex SDK に明示的に渡す API キー。 */
  apiKey?: string | undefined;
  /** Codex SDK の接続先を差し替える場合の base URL。 */
  baseUrl?: string | undefined;
  /** Codex SDK に渡す追加設定。 */
  config?: CodexOptions["config"] | undefined;
  /** Codex SDK に渡す環境変数。 */
  env?: CodexOptions["env"] | undefined;
  /** runtime 全体の既定モデル名。 */
  model?: string | undefined;
  /** Codex thread の作業ディレクトリ。 */
  workingDirectory?: string | undefined;
  /** Git 管理外ディレクトリでの実行を許可するかどうか。 */
  skipGitRepoCheck?: boolean | undefined;
}

/** Codex SDK を使う競馬予想 runtime を作成する。 */
export const createCodexSdkRuntime = (
  options: CodexSdkRuntimeOptions = {}
): CodexRaceAnalysisRuntime => {
  const codex = new Codex(buildCodexOptions(options));

  return {
    generatePrediction: async (request) => {
      // 1分析ごとに thread を分け、プロンプト間の文脈混入を避ける。
      const thread = codex.startThread(buildThreadOptions(request, options));
      const turn = await thread.run(request.prompt, { outputSchema: request.outputSchema });
      return parseCodexJson(turn.finalResponse);
    }
  };
};

/** Codex thread の実行オプションを組み立てる。 */
const buildThreadOptions = (
  request: CodexRaceAnalysisRequest,
  options: CodexSdkRuntimeOptions
): ThreadOptions => {
  const threadOptions: ThreadOptions = {
    // 分析では保存済みデータの読み取りだけを許可し、外部取得やファイル変更をさせない。
    sandboxMode: "read-only",
    approvalPolicy: "never",
    webSearchMode: "disabled"
  };

  const model = request.model ?? options.model;
  if (model !== undefined) {
    threadOptions.model = model;
  }
  if (options.workingDirectory !== undefined) {
    threadOptions.workingDirectory = options.workingDirectory;
  }
  if (options.skipGitRepoCheck !== undefined) {
    threadOptions.skipGitRepoCheck = options.skipGitRepoCheck;
  }

  return threadOptions;
};

/** undefined を渡さず、指定された値だけを Codex SDK の初期化オプションへ反映する。 */
const buildCodexOptions = (options: CodexSdkRuntimeOptions): CodexOptions => {
  const codexOptions: CodexOptions = {};

  if (options.apiKey !== undefined) {
    codexOptions.apiKey = options.apiKey;
  }
  if (options.baseUrl !== undefined) {
    codexOptions.baseUrl = options.baseUrl;
  }
  if (options.config !== undefined) {
    codexOptions.config = options.config;
  }
  if (options.env !== undefined) {
    codexOptions.env = options.env;
  }

  return codexOptions;
};

/** Codex SDK の最終応答を JSON として解釈する。 */
const parseCodexJson = (value: string): unknown => {
  try {
    // outputSchema を指定していても、保存前の検証は models 側で必ず行う。
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error("Codex SDK の分析結果をJSONとして解釈できません。", { cause: error });
  }
};
