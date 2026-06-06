import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

/** ブラウザ操作セッションを作成するときの設定。 */
export interface BrowserSessionOptions {
  /** Chromium を headless で起動するかどうか。未指定時は操作が見えるように headless では起動しない。 */
  headless?: boolean;
}

const blockedResourceTypes = new Set(["image", "media", "font"]);

/** Playwright の browser/context/page と終了処理をまとめたセッション。 */
export interface BrowserSession {
  /** 起動した Chromium browser。 */
  browser: Browser;
  /** 対象ページを開く browser context。 */
  context: BrowserContext;
  /** netKeiba のページ操作に使う page。 */
  page: Page;
  /** context と browser を閉じる終了処理。 */
  close: () => Promise<void>;
}

/** netKeiba のページを1件ずつ開くための Playwright セッションを作成する。 */
export const createBrowserSession = async (
  options: BrowserSessionOptions = {}
): Promise<BrowserSession> => {
  const browser = await launchChromium(options);
  const context = await browser.newContext();
  await context.route("**/*", async (route) => {
    // 解析に不要な重い静的リソースだけを止め、HTML/JS/XHR は通常通り取得する。
    if (blockedResourceTypes.has(route.request().resourceType())) {
      await route.abort();
      return;
    }

    await route.continue();
  });
  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    close: async () => {
      await context.close();
      await browser.close();
    }
  };
};

/** Chromium を起動し、Playwrightブラウザ未インストール時は実行すべきコマンドを明示する。 */
const launchChromium = async (options: BrowserSessionOptions): Promise<Browser> => {
  try {
    return await chromium.launch({ headless: options.headless ?? false });
  } catch (error) {
    if (isMissingPlaywrightBrowserError(error)) {
      throw new Error(
        [
          "Playwright のブラウザ本体が見つかりません。",
          "初回実行前に次のコマンドで Chromium をインストールしてください。",
          "",
          "pnpm --filter @keiba-ai-assistant/scraper exec playwright install chromium"
        ].join("\n"),
        { cause: error }
      );
    }

    throw error;
  }
};

/** Playwright のブラウザ実体が未インストールで起動できないエラーかどうかを判定する。 */
const isMissingPlaywrightBrowserError = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    error.message.includes("Executable doesn't exist") &&
    error.message.includes("playwright install")
  );
};
