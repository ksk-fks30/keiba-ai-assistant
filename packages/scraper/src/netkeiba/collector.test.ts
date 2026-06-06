import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SourcePageSnapshot } from "@keiba-ai-assistant/models";
import { collectRaceSnapshotFromNetkeiba } from "@keiba-ai-assistant/scraper/netkeiba/collector";

const mocks = vi.hoisted(() => {
  return {
    close: vi.fn(),
    createBrowserSession: vi.fn(),
    createSourcePageSnapshot: vi.fn(),
    goto: vi.fn(),
    waitForNextPage: vi.fn()
  };
});

vi.mock("@keiba-ai-assistant/scraper/netkeiba/browser", () => {
  return {
    createBrowserSession: mocks.createBrowserSession
  };
});

vi.mock("@keiba-ai-assistant/scraper/netkeiba/rate-limit", () => {
  return {
    waitForNextPage: mocks.waitForNextPage
  };
});

vi.mock("@keiba-ai-assistant/scraper/netkeiba/snapshot", () => {
  return {
    createSourcePageSnapshot: mocks.createSourcePageSnapshot
  };
});

const raceUrl = "https://race.netkeiba.com/race/shutuba.html?race_id=202605021211";

describe("collectRaceSnapshotFromNetkeiba", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.goto.mockResolvedValue(undefined);
    mocks.close.mockResolvedValue(undefined);
    mocks.waitForNextPage.mockResolvedValue(undefined);
    mocks.createBrowserSession.mockResolvedValue({
      page: { goto: mocks.goto },
      close: mocks.close
    });
  });

  test("上限未指定なら馬詳細ページと血統ページを全件取得する", async () => {
    // Arrange
    setupSourcePageSnapshots(20);

    // Act
    const actual = await collectRaceSnapshotFromNetkeiba({ raceUrl, minDelayMs: 1 });

    // Assert
    expect(actual.horseDetailPages).toHaveLength(20);
    expect(actual.pedigreePages).toHaveLength(20);
    expect(actual.pedigreePages[0]).toMatchObject({
      horseId: "0000000001",
      horseName: "horse-1",
      relation: "horse"
    });
    expect(mocks.goto).toHaveBeenCalledTimes(41);
    expect(mocks.goto).toHaveBeenLastCalledWith("https://db.netkeiba.com/horse/ped/0000000020/", {
      waitUntil: "domcontentloaded"
    });
  });

  test("上限指定があれば指定件数だけ馬詳細ページと血統ページを取得する", async () => {
    // Arrange
    setupSourcePageSnapshots(20);

    // Act
    const actual = await collectRaceSnapshotFromNetkeiba({
      raceUrl,
      minDelayMs: 1,
      horseDetailLimit: 18
    });

    // Assert
    expect(actual.horseDetailPages).toHaveLength(18);
    expect(actual.pedigreePages).toHaveLength(18);
    expect(mocks.goto).toHaveBeenCalledTimes(37);
    expect(mocks.goto).toHaveBeenLastCalledWith("https://db.netkeiba.com/horse/ped/0000000018/", {
      waitUntil: "domcontentloaded"
    });
  });

  test("馬詳細ページと血統ページのsnapshotを軽量設定で作成する", async () => {
    // Arrange
    setupSourcePageSnapshots(1);

    // Act
    await collectRaceSnapshotFromNetkeiba({ raceUrl, minDelayMs: 1 });

    // Assert
    expect(mocks.createSourcePageSnapshot.mock.calls[0]?.[1]).toMatchObject({
      visibleTextLimit: 16_000,
      tableTextLimit: 4_000,
      tableLimit: 10,
      linkLimit: 200,
      priorityLinkPatterns: expect.arrayContaining([expect.any(RegExp)])
    });
    expect(mocks.createSourcePageSnapshot.mock.calls[1]?.[1]).toMatchObject({
      visibleTextLimit: 7_000,
      tableTextLimit: 3_000,
      tableLimit: 8,
      linkLimit: 0
    });
    expect(mocks.createSourcePageSnapshot.mock.calls[2]?.[1]).toMatchObject({
      visibleTextLimit: 4_000,
      tableTextLimit: 3_000,
      tableLimit: 4,
      linkLimit: 0
    });
  });

  test("待機時間未指定なら全頭取得向けの既定間隔で待機する", async () => {
    // Arrange
    setupSourcePageSnapshots(1);

    // Act
    await collectRaceSnapshotFromNetkeiba({ raceUrl });

    // Assert
    expect(mocks.waitForNextPage).toHaveBeenCalledTimes(3);
    expect(mocks.waitForNextPage).toHaveBeenNthCalledWith(1, { minDelayMs: 15_000 });
    expect(mocks.waitForNextPage).toHaveBeenNthCalledWith(2, { minDelayMs: 15_000 });
    expect(mocks.waitForNextPage).toHaveBeenNthCalledWith(3, { minDelayMs: 15_000 });
  });

  test("中止signalをページ間待機へ渡す", async () => {
    // Arrange
    setupSourcePageSnapshots(1);
    const abortController = new AbortController();

    // Act
    await collectRaceSnapshotFromNetkeiba({
      raceUrl,
      minDelayMs: 1,
      signal: abortController.signal
    });

    // Assert
    expect(mocks.waitForNextPage).toHaveBeenNthCalledWith(1, {
      minDelayMs: 1,
      signal: abortController.signal
    });
    expect(mocks.waitForNextPage).toHaveBeenNthCalledWith(2, {
      minDelayMs: 1,
      signal: abortController.signal
    });
    expect(mocks.waitForNextPage).toHaveBeenNthCalledWith(3, {
      minDelayMs: 1,
      signal: abortController.signal
    });
  });

  test("中止済みsignalならブラウザ起動前に停止する", async () => {
    // Arrange
    const abortController = new AbortController();
    abortController.abort();

    // Act
    const actual = collectRaceSnapshotFromNetkeiba({
      raceUrl,
      minDelayMs: 1,
      signal: abortController.signal
    });

    // Assert
    await expect(actual).rejects.toThrow("netKeiba の取得を中止しました。");
    expect(mocks.createBrowserSession).not.toHaveBeenCalled();
  });

  test("待機中に中止されたらブラウザを閉じて停止する", async () => {
    // Arrange
    setupSourcePageSnapshots(1);
    const abortController = new AbortController();
    mocks.waitForNextPage.mockImplementationOnce(async () => {
      abortController.abort();
      throw new Error("待機を中断しました。");
    });

    // Act
    const actual = collectRaceSnapshotFromNetkeiba({
      raceUrl,
      minDelayMs: 1,
      signal: abortController.signal
    });

    // Assert
    await expect(actual).rejects.toThrow("netKeiba の取得を中止しました。");
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  test("上限が0なら馬詳細ページと血統ページを取得しない", async () => {
    // Arrange
    setupSourcePageSnapshots(20);

    // Act
    const actual = await collectRaceSnapshotFromNetkeiba({
      raceUrl,
      minDelayMs: 1,
      horseDetailLimit: 0
    });

    // Assert
    expect(actual.horseDetailPages).toEqual([]);
    expect(actual.pedigreePages).toEqual([]);
    expect(mocks.goto).toHaveBeenCalledTimes(1);
    expect(mocks.createSourcePageSnapshot).toHaveBeenCalledTimes(1);
  });
});

/** collector テスト用にsnapshot作成順を差し替える。 */
const setupSourcePageSnapshots = (horseCount: number): void => {
  let snapshotIndex = 0;
  mocks.createSourcePageSnapshot.mockImplementation(async () => {
    if (snapshotIndex === 0) {
      snapshotIndex += 1;
      return createRacePageSnapshot(horseCount);
    }

    const horsePageIndex = snapshotIndex - 1;
    const horseNumber = Math.floor(horsePageIndex / 2) + 1;
    const isPedigreePage = horsePageIndex % 2 === 1;
    snapshotIndex += 1;
    if (isPedigreePage) {
      return createHorsePedigreeSnapshot(horseNumber);
    }

    return createHorseDetailSnapshot(horseNumber);
  });
};

/** collector テスト用のレースページsnapshotを作る。 */
const createRacePageSnapshot = (horseCount: number): SourcePageSnapshot => {
  return {
    sourceUrl: raceUrl,
    pageTitle: "テストレース",
    visibleText: "テストレース 出走表",
    headings: ["テストレース"],
    tableTexts: [],
    links: createHorseDetailLinks(horseCount),
    capturedAt: "2026-05-31T12:10:00.000Z"
  };
};

/** collector テスト用の馬詳細ページsnapshotを作る。 */
const createHorseDetailSnapshot = (horseNumber: number): SourcePageSnapshot => {
  return {
    sourceUrl: `https://db.netkeiba.com/horse/${horseNumber.toString().padStart(10, "0")}/`,
    pageTitle: `horse-${horseNumber}`,
    visibleText: `horse-${horseNumber} detail`,
    headings: [`horse-${horseNumber}`],
    tableTexts: [],
    links: [],
    capturedAt: "2026-05-31T12:10:00.000Z"
  };
};

/** collector テスト用の血統ページsnapshotを作る。 */
const createHorsePedigreeSnapshot = (horseNumber: number): SourcePageSnapshot => {
  return {
    sourceUrl: `https://db.netkeiba.com/horse/ped/${horseNumber.toString().padStart(10, "0")}/`,
    pageTitle: `horse-${horseNumber} pedigree`,
    visibleText: `horse-${horseNumber} pedigree\nテスト系\nFNo.[1-a]`,
    headings: [`horse-${horseNumber} pedigree`],
    tableTexts: ["5代血統表"],
    links: [],
    capturedAt: "2026-05-31T12:10:00.000Z"
  };
};

/** collector テスト用の馬詳細リンク一覧を作る。 */
const createHorseDetailLinks = (count: number): SourcePageSnapshot["links"] => {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;

    return {
      text: `horse-${number}`,
      href: `https://db.netkeiba.com/horse/${number.toString().padStart(10, "0")}/`
    };
  });
};
