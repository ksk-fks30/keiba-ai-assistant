import {
  parseRaceSourceSnapshot,
  type RaceSourcePedigreePage,
  type RaceSourceSnapshot,
  type SourcePageLink,
  type SourcePageSnapshot
} from "@keiba-ai-assistant/models";
import { createBrowserSession } from "@keiba-ai-assistant/scraper/netkeiba/browser";
import { detectNetkeibaRestriction } from "@keiba-ai-assistant/scraper/netkeiba/access-control";
import {
  buildHorsePedigreeHref,
  findHorseDetailLinks,
  readHorseIdFromDetailHref
} from "@keiba-ai-assistant/scraper/netkeiba/horse-detail-link";
import { waitForNextPage } from "@keiba-ai-assistant/scraper/netkeiba/rate-limit";
import {
  createSourcePageSnapshot,
  type SourcePageSnapshotOptions
} from "@keiba-ai-assistant/scraper/netkeiba/snapshot";

/** netKeiba の対象レースページから snapshot を取得する入力。 */
export interface CollectRaceSnapshotInput {
  /** 取得対象の netKeiba レースURL。 */
  raceUrl: string;
  /** ページ表示後に最低限待機する時間。ミリ秒単位。 */
  minDelayMs?: number;
  /** レースページから遷移して取得する馬詳細ページの最大件数。未指定なら全頭、0なら取得しない。 */
  horseDetailLimit?: number;
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
const horseDetailLinkPatterns = [/\/horse\/[0-9A-Za-z]+\//, /[?&]horse_id=[0-9A-Za-z]+/];
const abortedCollectMessage = "netKeiba の取得を中止しました。";

/** netKeiba のレースページと馬詳細ページを1ページずつ開き、AI構造化に渡す軽量 snapshot を返す。 */
export const collectRaceSnapshotFromNetkeiba = async (
  input: CollectRaceSnapshotInput
): Promise<RaceSourceSnapshot> => {
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
  const closeSessionOnAbort = (): void => {
    const pendingClose = closeSession();
    pendingClose.catch(() => {
      // 中止要求後は元の中止エラーを優先するため、終了処理の失敗は握りつぶす。
    });
  };
  input.signal?.addEventListener("abort", closeSessionOnAbort, { once: true });

  try {
    throwIfAborted(input.signal);
    reportProgress(input, `レースページを開いています: ${input.raceUrl}`);
    await gotoPage(session.page, input.raceUrl, input);
    reportProgress(
      input,
      `アクセス間隔を待機しています: ${input.minDelayMs ?? defaultMinDelayMs}ms`
    );
    await waitForNextPage(buildRateLimitOptions(input));

    reportProgress(input, "レースページのsnapshotを作成しています。");
    throwIfAborted(input.signal);
    const racePage = await createSourcePageSnapshot(
      session.page,
      buildRacePageSnapshotOptions(input)
    );
    throwIfAborted(input.signal);
    throwIfRestricted(racePage);
    const { horseDetailPages, pedigreePages } = await collectHorsePages(
      session.page,
      racePage,
      input
    );

    throwIfAborted(input.signal);
    reportProgress(input, "netKeiba snapshot取得が完了しました。");
    return parseRaceSourceSnapshot({ racePage, horseDetailPages, pedigreePages });
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
const buildBrowserSessionOptions = (input: CollectRaceSnapshotInput) => {
  if (input.headless === undefined) {
    return {};
  }

  return { headless: input.headless };
};

/** レースページから馬詳細リンクへ1件ずつ遷移し、馬詳細と血統ページの軽量snapshotを返す。 */
const collectHorsePages = async (
  page: Parameters<typeof createSourcePageSnapshot>[0],
  racePage: SourcePageSnapshot,
  input: CollectRaceSnapshotInput
): Promise<{
  horseDetailPages: SourcePageSnapshot[];
  pedigreePages: RaceSourcePedigreePage[];
}> => {
  if (input.horseDetailLimit === 0) {
    reportProgress(input, "馬詳細ページの取得はスキップします。");
    return { horseDetailPages: [], pedigreePages: [] };
  }

  const links = selectHorseDetailLinks(findHorseDetailLinks(racePage), input.horseDetailLimit);
  reportProgress(input, `馬詳細ページを取得します: ${links.length}件`);
  const horseDetailPages: SourcePageSnapshot[] = [];
  const pedigreePages: RaceSourcePedigreePage[] = [];

  for (const [index, link] of links.entries()) {
    throwIfAborted(input.signal);
    // 馬詳細ページも1件ずつ開き、ページごとに待機して短時間アクセスを避ける。
    reportProgress(
      input,
      `馬詳細ページを開いています (${index + 1}/${links.length}): ${link.text}`
    );
    await gotoPage(page, link.href, input);
    reportProgress(
      input,
      `アクセス間隔を待機しています: ${input.minDelayMs ?? defaultMinDelayMs}ms`
    );
    await waitForNextPage(buildRateLimitOptions(input));

    reportProgress(
      input,
      `馬詳細ページのsnapshotを作成しています (${index + 1}/${links.length})。`
    );
    throwIfAborted(input.signal);
    const snapshot = await createSourcePageSnapshot(page, buildHorseDetailSnapshotOptions(input));
    throwIfAborted(input.signal);
    throwIfRestricted(snapshot);
    horseDetailPages.push(snapshot);
    const pedigreePage = await collectHorsePedigreePage(page, link, index, links.length, input);
    if (pedigreePage !== null) {
      pedigreePages.push(pedigreePage);
    }
  }

  return { horseDetailPages, pedigreePages };
};

/** 馬詳細ページから同じ馬の血統ページへ遷移し、系統抽出用のsnapshotを返す。 */
const collectHorsePedigreePage = async (
  page: Parameters<typeof createSourcePageSnapshot>[0],
  link: SourcePageLink,
  index: number,
  total: number,
  input: CollectRaceSnapshotInput
): Promise<RaceSourcePedigreePage | null> => {
  const horseId = readHorseIdFromDetailHref(link.href);
  const pedigreeHref = buildHorsePedigreeHref(link.href);
  if (horseId === null || pedigreeHref === null) {
    reportProgress(input, `血統ページURLを作成できないためスキップします: ${link.text}`);
    return null;
  }

  reportProgress(input, `血統ページを開いています (${index + 1}/${total}): ${link.text}`);
  await gotoPage(page, pedigreeHref, input);
  reportProgress(input, `アクセス間隔を待機しています: ${input.minDelayMs ?? defaultMinDelayMs}ms`);
  await waitForNextPage(buildRateLimitOptions(input));

  reportProgress(input, `血統ページのsnapshotを作成しています (${index + 1}/${total})。`);
  throwIfAborted(input.signal);
  const snapshot = await createSourcePageSnapshot(page, buildPedigreeSnapshotOptions(input));
  throwIfAborted(input.signal);
  throwIfRestricted(snapshot);

  return {
    horseId,
    horseName: link.text,
    relation: "horse",
    page: snapshot
  };
};

/** 馬詳細リンクの取得対象を、指定上限または全頭に絞る。 */
const selectHorseDetailLinks = (
  links: SourcePageSnapshot["links"],
  horseDetailLimit: number | undefined
): SourcePageSnapshot["links"] => {
  if (horseDetailLimit === undefined) {
    return links;
  }

  return links.slice(0, horseDetailLimit);
};

/** snapshot 内にアクセス制限や警告があれば取得を停止する。 */
const throwIfRestricted = (snapshot: SourcePageSnapshot): void => {
  const restriction = detectNetkeibaRestriction(snapshot);
  if (restriction === null) {
    return;
  }

  throw new Error(
    `netKeiba の取得を停止しました: ${restriction.reason} (${restriction.matchedText})`
  );
};

/** collect 入力からレースページの snapshot 作成設定だけを作る。 */
const buildRacePageSnapshotOptions = (
  input: CollectRaceSnapshotInput
): SourcePageSnapshotOptions => {
  const options: SourcePageSnapshotOptions = {
    visibleTextLimit: 16_000,
    tableTextLimit: 4_000,
    tableLimit: 10,
    linkLimit: 200,
    priorityLinkPatterns: horseDetailLinkPatterns
  };

  if (input.now === undefined) {
    return options;
  }

  return { ...options, now: input.now };
};

/** ページ遷移前後で中止要求を確認し、abort時は呼び出し元へ同じ中止エラーを返す。 */
const gotoPage = async (
  page: Parameters<typeof createSourcePageSnapshot>[0],
  url: string,
  input: CollectRaceSnapshotInput
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
  input: CollectRaceSnapshotInput
): Parameters<typeof waitForNextPage>[0] => {
  const options: Parameters<typeof waitForNextPage>[0] = {
    minDelayMs: input.minDelayMs ?? defaultMinDelayMs
  };
  if (input.signal !== undefined) {
    options.signal = input.signal;
  }

  return options;
};

/** 中止要求済みならnetKeiba取得を止める。 */
const throwIfAborted = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted !== true) {
    return;
  }

  throw new Error(abortedCollectMessage);
};

/** 呼び出し元が進捗表示を要求している場合だけメッセージを渡す。 */
const reportProgress = (input: CollectRaceSnapshotInput, message: string): void => {
  input.onProgress?.(message);
};

/** collect 入力から馬詳細ページの snapshot 作成設定だけを作る。 */
const buildHorseDetailSnapshotOptions = (
  input: CollectRaceSnapshotInput
): SourcePageSnapshotOptions => {
  const options: SourcePageSnapshotOptions = {
    visibleTextLimit: 7_000,
    tableTextLimit: 3_000,
    tableLimit: 8,
    linkLimit: 0
  };

  if (input.now === undefined) {
    return options;
  }

  return { ...options, now: input.now };
};

/** collect 入力から血統ページの snapshot 作成設定だけを作る。 */
const buildPedigreeSnapshotOptions = (
  input: CollectRaceSnapshotInput
): SourcePageSnapshotOptions => {
  const options: SourcePageSnapshotOptions = {
    visibleTextLimit: 4_000,
    tableTextLimit: 3_000,
    tableLimit: 4,
    linkLimit: 0
  };

  if (input.now === undefined) {
    return options;
  }

  return { ...options, now: input.now };
};
