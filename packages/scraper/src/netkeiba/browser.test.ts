import { describe, expect, test, vi } from "vitest";
import { createBrowserSession } from "@keiba-ai-assistant/scraper/netkeiba/browser";

const mocks = vi.hoisted(() => {
  return {
    abort: vi.fn(),
    continue: vi.fn(),
    contextClose: vi.fn(),
    browserClose: vi.fn(),
    launch: vi.fn(),
    newContext: vi.fn(),
    newPage: vi.fn(),
    request: vi.fn(),
    route: vi.fn()
  };
});

vi.mock("playwright", () => {
  return {
    chromium: {
      launch: mocks.launch
    }
  };
});

describe("createBrowserSession", () => {
  test("解析に不要な重い静的リソースだけを止める", async () => {
    // Arrange
    setupBrowserMocks();

    // Act
    const session = await createBrowserSession({ headless: true });
    const handler = mocks.route.mock.calls[0]?.[1] as
      | ((route: ReturnType<typeof createRoute>) => Promise<void>)
      | undefined;
    await handler?.(createRoute("image"));
    await handler?.(createRoute("font"));
    await handler?.(createRoute("document"));
    await session.close();

    // Assert
    expect(mocks.launch).toHaveBeenCalledWith({ headless: true });
    expect(mocks.route).toHaveBeenCalledWith("**/*", expect.any(Function));
    expect(mocks.abort).toHaveBeenCalledTimes(2);
    expect(mocks.continue).toHaveBeenCalledTimes(1);
    expect(mocks.contextClose).toHaveBeenCalledOnce();
    expect(mocks.browserClose).toHaveBeenCalledOnce();
  });
});

/** browser テスト用の Playwright mock を初期化する。 */
const setupBrowserMocks = (): void => {
  vi.resetAllMocks();
  mocks.abort.mockResolvedValue(undefined);
  mocks.continue.mockResolvedValue(undefined);
  mocks.contextClose.mockResolvedValue(undefined);
  mocks.browserClose.mockResolvedValue(undefined);
  mocks.newPage.mockResolvedValue({});
  mocks.route.mockResolvedValue(undefined);
  mocks.newContext.mockResolvedValue({
    close: mocks.contextClose,
    newPage: mocks.newPage,
    route: mocks.route
  });
  mocks.launch.mockResolvedValue({
    close: mocks.browserClose,
    newContext: mocks.newContext
  });
};

/** browser テスト用の Playwright route mock を作る。 */
const createRoute = (resourceType: string) => {
  return {
    abort: mocks.abort,
    continue: mocks.continue,
    request: () => ({
      resourceType: () => resourceType
    })
  };
};
