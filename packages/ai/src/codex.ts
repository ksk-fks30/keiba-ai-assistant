import { Codex, type CodexOptions, type ThreadOptions } from "@openai/codex-sdk";

/** Codex SDK に渡すJSON生成リクエスト。 */
export interface CodexJsonRequest {
  /** Codex に渡すプロンプト。 */
  prompt: string;
  /** Codex の structured output として要求する JSON Schema。 */
  outputSchema: unknown;
  /** この実行だけで使う Codex モデル名。 */
  model?: string | undefined;
  /** Codex CLI 子プロセスを中断するためのsignal。 */
  signal?: AbortSignal | undefined;
}

/** Codex を使って構造化JSONを生成する AI 実行基盤。 */
export interface CodexJsonRuntime {
  /** プロンプトと出力スキーマから未検証のJSON値を生成する。 */
  generateJson: (request: CodexJsonRequest) => Promise<unknown>;
}

/** Codex SDK runtime の初期化オプション。 */
export interface CodexSdkRuntimeOptions {
  /** Codex SDK の接続先を差し替える場合の base URL。 */
  baseUrl?: string | undefined;
  /** Codex SDK に渡す追加設定。 */
  config?: CodexOptions["config"] | undefined;
  /** runtime 全体の既定モデル名。 */
  model?: string | undefined;
  /** Codex thread の作業ディレクトリ。 */
  workingDirectory?: string | undefined;
  /** Git 管理外ディレクトリでの実行を許可するかどうか。 */
  skipGitRepoCheck?: boolean | undefined;
}

/** Codex SDK を使う競馬予想 runtime を作成する。 */
export const createCodexSdkRuntime = (options: CodexSdkRuntimeOptions = {}): CodexJsonRuntime => {
  const codex = new Codex(buildCodexOptions(options));

  return {
    generateJson: async (request) => {
      // 1実行ごとに thread を分け、プロンプト間の文脈混入を避ける。
      const thread = codex.startThread(buildThreadOptions(request, options));
      const turn = await thread.run(request.prompt, buildTurnOptions(request));
      return parseCodexJson(turn.finalResponse);
    }
  };
};

/** Codex の1 turn実行オプションを組み立てる。 */
const buildTurnOptions = (request: CodexJsonRequest) => {
  return {
    outputSchema: request.outputSchema,
    ...(request.signal === undefined ? {} : { signal: request.signal })
  };
};

/** Codex thread の実行オプションを組み立てる。 */
const buildThreadOptions = (
  request: CodexJsonRequest,
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

  if (options.baseUrl !== undefined) {
    codexOptions.baseUrl = options.baseUrl;
  }
  if (options.config !== undefined) {
    codexOptions.config = options.config;
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
