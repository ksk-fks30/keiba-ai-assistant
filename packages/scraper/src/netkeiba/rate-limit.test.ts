import { afterEach, describe, expect, test, vi } from "vitest";
import { waitForNextPage } from "@keiba-ai-assistant/scraper/netkeiba/rate-limit";

describe("waitForNextPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("指定時間の経過後に完了する", async () => {
    // Arrange
    vi.useFakeTimers();
    const actual = waitForNextPage({ minDelayMs: 1_000 });

    // Act
    await vi.advanceTimersByTimeAsync(1_000);

    // Assert
    await expect(actual).resolves.toBeUndefined();
  });

  test("待機中に中止されたら失敗する", async () => {
    // Arrange
    vi.useFakeTimers();
    const abortController = new AbortController();
    const actual = waitForNextPage({
      minDelayMs: 1_000,
      signal: abortController.signal
    });

    // Act
    abortController.abort();

    // Assert
    await expect(actual).rejects.toThrow("netKeiba の取得を中止しました。");
  });

  test("中止済みsignalでは待機を開始しない", async () => {
    // Arrange
    const abortController = new AbortController();
    abortController.abort();

    // Act
    const actual = waitForNextPage({
      minDelayMs: 1_000,
      signal: abortController.signal
    });

    // Assert
    await expect(actual).rejects.toThrow("netKeiba の取得を中止しました。");
  });
});
