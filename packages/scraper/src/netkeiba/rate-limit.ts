/** ページ遷移間の待機設定。 */
export interface RateLimitOptions {
  /** 次のページ操作まで最低限待機する時間。ミリ秒単位。 */
  minDelayMs: number;
}

/** netKeiba への連続アクセスを避けるため、ページ操作間に待機する。 */
export const waitForNextPage = async (options: RateLimitOptions): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, options.minDelayMs));
};
