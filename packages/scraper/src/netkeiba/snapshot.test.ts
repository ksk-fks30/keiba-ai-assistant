import type { Page } from "playwright";
import { describe, expect, test } from "vitest";
import { createSourcePageSnapshot } from "@keiba-ai-assistant/scraper/netkeiba/snapshot";
import { netkeibaSelectors } from "@keiba-ai-assistant/scraper/netkeiba/selectors";

interface TestAnchor {
  innerText: string;
  href: string;
}

type EvaluateAllCallback = (elements: TestAnchor[], arg?: unknown) => unknown;

describe("createSourcePageSnapshot", () => {
  test("上限外の優先リンクもsnapshotに残す", async () => {
    // Arrange
    const page = createPage([
      { innerText: "通常リンク1", href: "https://example.test/news/1" },
      { innerText: "通常リンク2", href: "https://example.test/news/2" },
      { innerText: "通常リンク3", href: "https://example.test/news/3" },
      { innerText: "シラユキコード", href: "https://db.netkeiba.com/horse/2023100001/" }
    ]);

    // Act
    const actual = await createSourcePageSnapshot(page, {
      linkLimit: 2,
      priorityLinkPatterns: [/\/horse\/[0-9A-Za-z]+\//],
      now: () => new Date("2026-05-31T10:30:00.000Z")
    });

    // Assert
    expect(actual.links).toEqual([
      {
        text: "シラユキコード",
        href: "https://db.netkeiba.com/horse/2023100001/"
      },
      { text: "通常リンク1", href: "https://example.test/news/1" }
    ]);
  });
});

/** snapshot テスト用の Playwright page mock を作る。 */
const createPage = (anchors: TestAnchor[]): Page => {
  const page = {
    locator: (selector: string) => {
      if (selector === netkeibaSelectors.links) {
        return {
          evaluateAll: async (callback: EvaluateAllCallback, arg?: unknown) =>
            callback(anchors, arg)
        };
      }

      if (selector === netkeibaSelectors.headings) {
        return {
          allInnerTexts: async () => ["青葉架空マイル"]
        };
      }

      if (selector === netkeibaSelectors.tables) {
        return {
          allInnerTexts: async () => ["馬番 馬名\n1 シラユキコード"]
        };
      }

      return {
        innerText: async () => "青葉架空マイル\n東京 芝1600m"
      };
    },
    title: async () => "青葉架空マイル",
    url: () => "https://race.netkeiba.com/race/shutuba.html?race_id=202605021211"
  };

  return page as unknown as Page;
};
