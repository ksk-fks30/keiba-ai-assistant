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

  test("上限未指定なら馬詳細ページを全件取得する", async () => {
    // Arrange
    setupSourcePageSnapshots(20);

    // Act
    const actual = await collectRaceSnapshotFromNetkeiba({ raceUrl, minDelayMs: 1 });

    // Assert
    expect(actual.horseDetailPages).toHaveLength(20);
    expect(mocks.goto).toHaveBeenCalledTimes(21);
    expect(mocks.goto).toHaveBeenLastCalledWith("https://db.netkeiba.com/horse/0000000020/", {
      waitUntil: "domcontentloaded"
    });
  });

  test("上限指定があれば指定件数だけ馬詳細ページを取得する", async () => {
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
    expect(mocks.goto).toHaveBeenCalledTimes(19);
    expect(mocks.goto).toHaveBeenLastCalledWith("https://db.netkeiba.com/horse/0000000018/", {
      waitUntil: "domcontentloaded"
    });
  });

  test("上限が0なら馬詳細ページを取得しない", async () => {
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

    const horseNumber = snapshotIndex;
    snapshotIndex += 1;
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
