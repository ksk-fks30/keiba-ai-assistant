import { describe, expect, test } from "vitest";
import { detectNetkeibaRestriction } from "@keiba-ai-assistant/scraper/netkeiba/access-control";
import type { SourcePageSnapshot } from "@keiba-ai-assistant/models";

describe("detectNetkeibaRestriction", () => {
  test("通信制限の文言がある場合は停止理由を返す", () => {
    // Arrange
    const snapshot = createSnapshot({
      visibleText: "データベースの閲覧ができない 通信制限がかかっています"
    });

    // Act
    const actual = detectNetkeibaRestriction(snapshot);

    // Assert
    expect(actual).toMatchObject({
      reason: "通信制限が表示されています",
      matchedText: "通信制限"
    });
  });

  test("通常ページのログイン導線だけでは制限扱いにしない", () => {
    // Arrange
    const snapshot = createSnapshot({
      visibleText: "青葉架空マイル ログイン 会員登録 馬番 馬名 騎手"
    });

    // Act
    const actual = detectNetkeibaRestriction(snapshot);

    // Assert
    expect(actual).toBeNull();
  });
});

/** access-control テスト用の最小ページsnapshotを作る。 */
const createSnapshot = (overrides: Partial<SourcePageSnapshot> = {}): SourcePageSnapshot => {
  return {
    sourceUrl: "https://example.test/race?race_id=fixture-aoba-mile-2026",
    pageTitle: "青葉架空マイル",
    visibleText: "青葉架空マイル",
    headings: ["青葉架空マイル"],
    tableTexts: [],
    links: [],
    capturedAt: "2026-05-31T10:30:00.000Z",
    ...overrides
  };
};
