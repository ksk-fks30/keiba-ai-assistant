import { describe, expect, test } from "vitest";
import {
  findHorseDetailLinks,
  normalizeHorseDetailHref
} from "@keiba-ai-assistant/scraper/netkeiba/horse-detail-link";
import type { SourcePageSnapshot } from "@keiba-ai-assistant/models";

describe("normalizeHorseDetailHref", () => {
  test("PC版の馬詳細リンクを正規化できる", () => {
    // Arrange
    const href = "https://db.netkeiba.com/horse/2023103687/?from=race#profile";

    // Act
    const actual = normalizeHorseDetailHref(href);

    // Assert
    expect(actual).toBe("https://db.netkeiba.com/horse/2023103687/");
  });

  test("SP版の馬詳細モーダルリンクを正規化できる", () => {
    // Arrange
    const href =
      "https://race.sp.netkeiba.com/modal/horse.html?race_id=202605021211&horse_id=2023103687";

    // Act
    const actual = normalizeHorseDetailHref(href);

    // Assert
    expect(actual).toBe("https://db.netkeiba.com/horse/2023103687/");
  });

  test("馬IDを持たないリンクは馬詳細リンクとして扱わない", () => {
    // Arrange
    const href = "https://race.netkeiba.com/race/shutuba.html?race_id=202605021211";

    // Act
    const actual = normalizeHorseDetailHref(href);

    // Assert
    expect(actual).toBeNull();
  });
});

describe("findHorseDetailLinks", () => {
  test("複数形式の馬詳細リンクを正規化して重複排除できる", () => {
    // Arrange
    const snapshot = createSnapshot([
      {
        text: "ライヒスアドラー",
        href: "https://db.netkeiba.com/horse/2023103687/"
      },
      {
        text: "ライヒスアドラー",
        href: "https://race.sp.netkeiba.com/modal/horse.html?race_id=202605021211&horse_id=2023103687"
      },
      {
        text: "レース詳細",
        href: "https://race.netkeiba.com/race/shutuba.html?race_id=202605021211"
      }
    ]);

    // Act
    const actual = findHorseDetailLinks(snapshot);

    // Assert
    expect(actual).toEqual([
      {
        text: "ライヒスアドラー",
        href: "https://db.netkeiba.com/horse/2023103687/"
      }
    ]);
  });
});

/** horse-detail-link テスト用のページsnapshotを作る。 */
const createSnapshot = (links: SourcePageSnapshot["links"]): SourcePageSnapshot => {
  return {
    sourceUrl: "https://race.netkeiba.com/race/shutuba.html?race_id=202605021211",
    pageTitle: "日本ダービー",
    visibleText: "日本ダービー",
    headings: ["日本ダービー"],
    tableTexts: [],
    links,
    capturedAt: "2026-05-31T12:10:00.000Z"
  };
};
