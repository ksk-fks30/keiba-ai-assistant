import {
  parseRaceSourceSnapshot,
  type RaceSourceSnapshot,
  type SourcePageSnapshot
} from "@keiba-ai-assistant/models";
import { createBrowserSession } from "@keiba-ai-assistant/scraper/netkeiba/browser";
import { detectNetkeibaRestriction } from "@keiba-ai-assistant/scraper/netkeiba/access-control";
import { findHorseDetailLinks } from "@keiba-ai-assistant/scraper/netkeiba/horse-detail-link";
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
  /** レースページから遷移して取得する馬詳細ページの最大件数。0なら取得しない。 */
  horseDetailLimit?: number;
  /** Chromium を headless で起動するかどうか。 */
  headless?: boolean;
  /** snapshot取得時刻を差し替える関数。テストで時刻を固定する場合に使う。 */
  now?: () => Date;
  /** CLIなど呼び出し元へ処理状況を伝える関数。 */
  onProgress?: ((message: string) => void) | undefined;
}

const defaultMinDelayMs = 5000;
const defaultHorseDetailLimit = 18;

/** netKeiba のレースページと馬詳細ページを1ページずつ開き、AI構造化に渡す軽量 snapshot を返す。 */
export const collectRaceSnapshotFromNetkeiba = async (
  input: CollectRaceSnapshotInput
): Promise<RaceSourceSnapshot> => {
  reportProgress(input, "Chromium を起動しています。");
  const session = await createBrowserSession(buildBrowserSessionOptions(input));

  try {
    reportProgress(input, `レースページを開いています: ${input.raceUrl}`);
    await session.page.goto(input.raceUrl, { waitUntil: "domcontentloaded" });
    reportProgress(
      input,
      `アクセス間隔を待機しています: ${input.minDelayMs ?? defaultMinDelayMs}ms`
    );
    await waitForNextPage({ minDelayMs: input.minDelayMs ?? defaultMinDelayMs });

    reportProgress(input, "レースページのsnapshotを作成しています。");
    const racePage = await createSourcePageSnapshot(
      session.page,
      buildRacePageSnapshotOptions(input)
    );
    throwIfRestricted(racePage);
    const horseDetailPages = await collectHorseDetailPages(session.page, racePage, input);

    reportProgress(input, "netKeiba snapshot取得が完了しました。");
    return parseRaceSourceSnapshot({ racePage, horseDetailPages });
  } finally {
    await session.close();
  }
};

/** collect 入力から Playwright セッション用の設定だけを作る。 */
const buildBrowserSessionOptions = (input: CollectRaceSnapshotInput) => {
  if (input.headless === undefined) {
    return {};
  }

  return { headless: input.headless };
};

/** レースページから馬詳細リンクへ1件ずつ遷移し、各ページの軽量snapshotを返す。 */
const collectHorseDetailPages = async (
  page: Parameters<typeof createSourcePageSnapshot>[0],
  racePage: SourcePageSnapshot,
  input: CollectRaceSnapshotInput
): Promise<SourcePageSnapshot[]> => {
  const limit = input.horseDetailLimit ?? defaultHorseDetailLimit;
  if (limit === 0) {
    reportProgress(input, "馬詳細ページの取得はスキップします。");
    return [];
  }

  const links = findHorseDetailLinks(racePage).slice(0, limit);
  reportProgress(input, `馬詳細ページを取得します: ${links.length}件`);
  const snapshots: SourcePageSnapshot[] = [];

  for (const [index, link] of links.entries()) {
    // 馬詳細ページも1件ずつ開き、ページごとに待機して短時間アクセスを避ける。
    reportProgress(
      input,
      `馬詳細ページを開いています (${index + 1}/${links.length}): ${link.text}`
    );
    await page.goto(link.href, { waitUntil: "domcontentloaded" });
    reportProgress(
      input,
      `アクセス間隔を待機しています: ${input.minDelayMs ?? defaultMinDelayMs}ms`
    );
    await waitForNextPage({ minDelayMs: input.minDelayMs ?? defaultMinDelayMs });

    reportProgress(
      input,
      `馬詳細ページのsnapshotを作成しています (${index + 1}/${links.length})。`
    );
    const snapshot = await createSourcePageSnapshot(page, buildHorseDetailSnapshotOptions(input));
    throwIfRestricted(snapshot);
    snapshots.push(snapshot);
  }

  return snapshots;
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
    linkLimit: 300
  };

  if (input.now === undefined) {
    return options;
  }

  return { ...options, now: input.now };
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
    visibleTextLimit: 12_000,
    tableTextLimit: 6_000,
    tableLimit: 12,
    linkLimit: 40
  };

  if (input.now === undefined) {
    return options;
  }

  return { ...options, now: input.now };
};
