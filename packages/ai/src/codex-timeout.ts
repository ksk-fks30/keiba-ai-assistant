/** Codex SDK 実行の中断制御を作る入力。 */
export interface CodexExecutionControlInput {
  /** Codex SDK 実行を待つ最大時間。未指定の場合は時間では中断しない。 */
  timeoutMs?: number | undefined;
  /** 呼び出し元からの中断通知。 */
  signal?: AbortSignal | undefined;
  /** タイムアウト時に表示するエラーメッセージを作る関数。 */
  buildTimeoutMessage: (timeoutMs: number) => string;
  /** 呼び出し元から中断された時に表示するエラーメッセージ。 */
  abortMessage: string;
}

/** Codex SDK 実行へ渡す AbortSignal と、待ち続けないための競争用 Promise。 */
export interface CodexExecutionControl {
  /** Codex runtime へ渡す AbortSignal。 */
  signal: AbortSignal | undefined;
  /** 中断またはタイムアウト時に reject する Promise。 */
  promise: Promise<never> | undefined;
  /** タイマーやイベント購読を破棄する。 */
  dispose: () => void;
}

/** Codex SDK 実行のタイムアウトと外部中断をまとめて扱う。 */
export const createCodexExecutionControl = (
  input: CodexExecutionControlInput
): CodexExecutionControl => {
  if (input.timeoutMs === undefined && input.signal === undefined) {
    return {
      signal: undefined,
      promise: undefined,
      dispose: () => {}
    };
  }
  if (
    input.timeoutMs !== undefined &&
    (!Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0)
  ) {
    throw new Error("timeoutMs は正の有限数で指定してください。");
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let isDisposed = false;
  let rejectControl: ((error: Error) => void) | undefined;

  const rejectOnce = (message: string): void => {
    if (isDisposed) {
      return;
    }

    isDisposed = true;
    controller.abort();
    rejectControl?.(new Error(message));
  };
  const abortListener = (): void => {
    rejectOnce(input.abortMessage);
  };
  const promise = new Promise<never>((_, reject) => {
    rejectControl = reject;
    if (input.timeoutMs !== undefined) {
      timeoutId = setTimeout(() => {
        rejectOnce(input.buildTimeoutMessage(input.timeoutMs as number));
      }, input.timeoutMs);
    }
    if (input.signal?.aborted === true) {
      abortListener();
      return;
    }

    input.signal?.addEventListener("abort", abortListener, { once: true });
  });

  return {
    signal: controller.signal,
    promise,
    dispose: () => {
      isDisposed = true;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      input.signal?.removeEventListener("abort", abortListener);
    }
  };
};

/** Codex SDK 実行と中断制御を競争させ、長時間待ち続けないようにする。 */
export const raceWithCodexExecutionControl = async <Value>(
  promise: Promise<Value>,
  controlPromise: Promise<never> | undefined
): Promise<Value> => {
  if (controlPromise === undefined) {
    return await promise;
  }

  return await Promise.race([promise, controlPromise]);
};
