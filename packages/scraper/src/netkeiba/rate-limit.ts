export interface RateLimitOptions {
  minDelayMs: number;
}

export async function waitForNextPage(options: RateLimitOptions): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, options.minDelayMs));
}
