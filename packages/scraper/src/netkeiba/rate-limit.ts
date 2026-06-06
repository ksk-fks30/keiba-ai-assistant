/** ページ遷移間の待機設定。 */
export interface RateLimitOptions {
  /** 次のページ操作まで最低限待機する時間。ミリ秒単位。 */
  minDelayMs: number;
  /** 呼び出し元から待機を中止するための通知。 */
  signal?: AbortSignal | undefined;
}

/** netKeiba への連続アクセスを避けるため、ページ操作間に待機する。 */
export const waitForNextPage = async (options: RateLimitOptions): Promise<void> => {
  throwIfAborted(options.signal);

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, options.minDelayMs);

    const handleAbort = (): void => {
      clearTimeout(timeoutId);
      cleanup();
      reject(new Error("netKeiba の取得を中止しました。"));
    };

    const cleanup = (): void => {
      options.signal?.removeEventListener("abort", handleAbort);
    };

    options.signal?.addEventListener("abort", handleAbort, { once: true });
    if (options.signal?.aborted === true) {
      handleAbort();
    }
  });
};

/** 待機開始前に中止済みなら即座に停止する。 */
const throwIfAborted = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted !== true) {
    return;
  }

  throw new Error("netKeiba の取得を中止しました。");
};
