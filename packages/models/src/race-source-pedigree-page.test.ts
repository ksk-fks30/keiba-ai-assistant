import { describe, expect, test } from "vitest";
import { parseRaceSourcePedigreePage } from "@keiba-ai-assistant/models/race-source-pedigree-page";

describe("parseRaceSourcePedigreePage", () => {
  test("出走馬に紐づく血統ページsnapshotを parse できる", () => {
    // Arrange
    const input = {
      horseId: "fixture-horse-001",
      horseName: "シラユキコード",
      relation: "horse",
      page: {
        sourceUrl: "https://example.test/horse/ped/fixture-horse-001",
        pageTitle: "シラユキコード 血統",
        visibleText: "5代血統表\nフィクションキング\nフィクション系",
        headings: ["5代血統表"],
        tableTexts: ["フィクションキング\nフィクション系\nFNo.[7-f]"],
        links: [],
        capturedAt: "2026-05-31T10:30:00.000Z"
      }
    };

    // Act
    const actual = parseRaceSourcePedigreePage(input);

    // Assert
    expect(actual).toEqual(input);
  });
});
