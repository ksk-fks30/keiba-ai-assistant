import { describe, expect, test } from "vitest";
import { parseRaceDraftHorse } from "@keiba-ai-assistant/models/race-draft-horse";

describe("parseRaceDraftHorse", () => {
  test("AIが抽出した最小限の出走馬情報を parse できる", () => {
    // Arrange
    const input = {
      id: "fixture-horse-001",
      name: "シラユキコード",
      horseNumber: 1,
      jockey: "架空 太郎",
      pedigree: {
        sire: "フィクションキング",
        dam: "シラユキメモリー",
        damSire: "マイルクラフト",
        familyNotes: ["芝マイル向きの持続力を示す。"]
      },
      pastPerformances: [
        {
          date: "2026-04-12",
          raceName: "架空トライアル",
          racecourse: "東京",
          surface: "turf",
          distanceMeters: 1600,
          trackCondition: "良",
          finishPosition: 1,
          jockey: "架空 太郎",
          weightCarriedKg: 55,
          bodyWeightKg: 480,
          odds: 3.2,
          popularity: 1,
          margin: "0.2",
          runningStyle: "先行",
          note: "直線で余力があった。"
        }
      ]
    };

    // Act
    const actual = parseRaceDraftHorse(input);

    // Assert
    expect(actual).toEqual(input);
  });
});
