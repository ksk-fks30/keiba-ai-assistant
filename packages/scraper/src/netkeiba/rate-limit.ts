export interface RateLimitOptions {
  minDelayMs: number;
}

export const waitForNextPage = async (options: RateLimitOptions): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, options.minDelayMs));
};
