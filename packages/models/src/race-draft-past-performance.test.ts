import { describe, expect, test } from "vitest";
import { parseRaceDraftPastPerformance } from "@keiba-ai-assistant/models/race-draft-past-performance";

describe("parseRaceDraftPastPerformance", () => {
  test("AIが抽出した過去走情報を parse できる", () => {
    // Arrange
    const input = {
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
    };

    // Act
    const actual = parseRaceDraftPastPerformance(input);

    // Assert
    expect(actual).toEqual(input);
  });

  test("不明な任意項目を null や空文字で parse できる", () => {
    // Arrange
    const input = {
      date: "2026-04-12",
      raceName: "架空トライアル",
      racecourse: "",
      surface: "unknown",
      distanceMeters: null,
      trackCondition: "",
      finishPosition: null,
      jockey: "",
      weightCarriedKg: null,
      bodyWeightKg: null,
      odds: null,
      popularity: null,
      margin: "",
      runningStyle: "",
      note: ""
    };

    // Act
    const actual = parseRaceDraftPastPerformance(input);

    // Assert
    expect(actual).toEqual(input);
  });
});
