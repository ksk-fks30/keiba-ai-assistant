import { describe, expect, test } from "vitest";
import { parseSourcePageSnapshot } from "@keiba-ai-assistant/models/source-page-snapshot";

describe("parseSourcePageSnapshot", () => {
  test("HTMLや生DOMを含まないページsnapshotを parse できる", () => {
    // Arrange
    const input = {
      sourceUrl: "https://example.test/race?race_id=fixture-aoba-mile-2026",
      pageTitle: "青葉架空マイル",
      visibleText: "青葉架空マイル\n東京 芝1600m",
      headings: ["青葉架空マイル"],
      tableTexts: ["馬番 馬名 騎手\n1 シラユキコード 架空太郎"],
      links: [
        {
          text: "シラユキコード",
          href: "https://example.test/horse/fixture-horse-001"
        }
      ],
      capturedAt: "2026-05-31T10:30:00.000Z"
    };

    // Act
    const actual = parseSourcePageSnapshot(input);

    // Assert
    expect(actual).toEqual(input);
  });
});
