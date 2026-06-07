import { describe, expect, test } from "vitest";
import { parsePrediction } from "@keiba-ai-assistant/models/prediction";

describe("parsePrediction", () => {
  test("旧形式の予想結果ではreferencedLessonsを空配列として扱う", () => {
    // Arrange
    const value = {
      raceId: "fixture-race",
      summary: "架空レースでは先行力を重視する。",
      evaluations: [
        {
          horseId: "fixture-horse-001",
          mark: "favorite",
          score: 88,
          reasons: ["芝マイルで安定している。"],
          risks: ["展開が速くなりすぎる可能性がある。"]
        }
      ],
      betCandidates: [
        {
          type: "単勝",
          horses: ["fixture-horse-001"],
          reason: "軸として最も安定している。",
          stakeWeight: 100
        }
      ],
      generatedAt: "2026-05-31T05:40:00.000Z"
    };

    // Act
    const actual = parsePrediction(value);

    // Assert
    expect(actual.referencedLessons).toEqual([]);
  });
});
