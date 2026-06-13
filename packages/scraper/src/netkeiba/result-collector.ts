import { parseSourcePageSnapshot, type SourcePageSnapshot } from "@keiba-ai-assistant/models";
import { detectNetkeibaRestriction } from "@keiba-ai-assistant/scraper/netkeiba/access-control";
import { createBrowserSession } from "@keiba-ai-assistant/scraper/netkeiba/browser";
import { waitForNextPage } from "@keiba-ai-assistant/scraper/netkeiba/rate-limit";
import {
  createSourcePageSnapshot,
  type SourcePageSnapshotOptions
} from "@keiba-ai-assistant/scraper/netkeiba/snapshot";

/** netKeiba の対象レース結果ページから snapshot を取得する入力。 */
export interface CollectRaceResultSnapshotInput {
  /** 取得対象の netKeiba レース結果URL。 */
  resultUrl: string;
  /** ページ表示後に最低限待機する時間。ミリ秒単位。 */
  minDelayMs?: number;
  /** Chromium を headless で起動するかどうか。 */
  headless?: boolean;
  /** snapshot取得時刻を差し替える関数。テストで時刻を固定する場合に使う。 */
  now?: () => Date;
  /** CLIなど呼び出し元へ処理状況を伝える関数。 */
  onProgress?: ((message: string) => void) | undefined;
  /** 呼び出し元からnetKeiba取得を中止するための通知。 */
  signal?: AbortSignal | undefined;
}

const defaultMinDelayMs = 15_000;
const abortedCollectMessage = "netKeiba の結果取得を中止しました。";

/** race IDからnetKeiba結果ページURLを作る。 */
export const buildNetkeibaRaceResultUrl = (raceId: string): string => {
  const url = new URL("https://race.netkeiba.com/race/result.html");
  url.searchParams.set("race_id", raceId);
  return url.toString();
};

/** netKeiba の結果ページを開き、AI構造化に渡す軽量 snapshot を返す。 */
export const collectRaceResultSnapshotFromNetkeiba = async (
  input: CollectRaceResultSnapshotInput
): Promise<SourcePageSnapshot> => {
  throwIfAborted(input.signal);
  reportProgress(input, "Chromium を起動しています。");
  const session = await createBrowserSession(buildBrowserSessionOptions(input));
  let isSessionClosed = false;
  const closeSession = async (): Promise<void> => {
    if (isSessionClosed) {
      return;
    }

    isSessionClosed = true;
    await session.close();
  };
  const closeSessionOnAbort = async (): Promise<void> => {
    try {
      await closeSession();
    } catch (error) {
      reportProgress(input, `中止時のChromium終了に失敗しました: ${readErrorMessage(error)}`);
    }
  };
  input.signal?.addEventListener("abort", closeSessionOnAbort, { once: true });

  try {
    throwIfAborted(input.signal);
    reportProgress(input, `レース結果ページを開いています: ${input.resultUrl}`);
    await gotoPage(session.page, input.resultUrl, input);
    reportProgress(
      input,
      `アクセス間隔を待機しています: ${input.minDelayMs ?? defaultMinDelayMs}ms`
    );
    await waitForNextPage(buildRateLimitOptions(input));

    reportProgress(input, "レース結果ページのsnapshotを作成しています。");
    throwIfAborted(input.signal);
    const snapshot = await createSourcePageSnapshot(
      session.page,
      buildResultSnapshotOptions(input)
    );
    throwIfAborted(input.signal);
    throwIfRestricted(snapshot);

    reportProgress(input, "netKeiba 結果snapshot取得が完了しました。");
    return parseSourcePageSnapshot(snapshot);
  } catch (error) {
    if (input.signal?.aborted === true) {
      throw new Error(abortedCollectMessage, { cause: error });
    }

    throw error;
  } finally {
    input.signal?.removeEventListener("abort", closeSessionOnAbort);
    await closeSession();
  }
};

/** collect 入力から Playwright セッション用の設定だけを作る。 */
const buildBrowserSessionOptions = (input: CollectRaceResultSnapshotInput) => {
  if (input.headless === undefined) {
    return {};
  }

  return { headless: input.headless };
};

/** ページ遷移前後で中止要求を確認し、abort時は呼び出し元へ同じ中止エラーを返す。 */
const gotoPage = async (
  page: Parameters<typeof createSourcePageSnapshot>[0],
  url: string,
  input: CollectRaceResultSnapshotInput
): Promise<void> => {
  throwIfAborted(input.signal);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
  } catch (error) {
    if (input.signal?.aborted === true) {
      throw new Error(abortedCollectMessage, { cause: error });
    }

    throw error;
  }
  throwIfAborted(input.signal);
};

/** collect 入力からページ間待機設定を作る。 */
const buildRateLimitOptions = (
  input: CollectRaceResultSnapshotInput
): Parameters<typeof waitForNextPage>[0] => {
  const options: Parameters<typeof waitForNextPage>[0] = {
    minDelayMs: input.minDelayMs ?? defaultMinDelayMs
  };
  if (input.signal !== undefined) {
    options.signal = input.signal;
  }

  return options;
};

/** collect 入力から結果ページの snapshot 作成設定だけを作る。 */
const buildResultSnapshotOptions = (
  input: CollectRaceResultSnapshotInput
): SourcePageSnapshotOptions => {
  const options: SourcePageSnapshotOptions = {
    visibleTextLimit: 14_000,
    tableTextLimit: 4_000,
    tableLimit: 10,
    linkLimit: 0
  };

  if (input.now === undefined) {
    return options;
  }

  return { ...options, now: input.now };
};

/** snapshot 内にアクセス制限や警告があれば取得を停止する。 */
const throwIfRestricted = (snapshot: SourcePageSnapshot): void => {
  const restriction = detectNetkeibaRestriction(snapshot);
  if (restriction === null) {
    return;
  }

  throw new Error(
    `netKeiba の結果取得を停止しました: ${restriction.reason} (${restriction.matchedText})`
  );
};

/** 中止要求済みならnetKeiba結果取得を止める。 */
const throwIfAborted = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted !== true) {
    return;
  }

  throw new Error(abortedCollectMessage);
};

/** 呼び出し元が進捗表示を要求している場合だけメッセージを渡す。 */
const reportProgress = (input: CollectRaceResultSnapshotInput, message: string): void => {
  input.onProgress?.(message);
};

/** unknown errorから進捗表示用のメッセージを取り出す。 */
const readErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};
