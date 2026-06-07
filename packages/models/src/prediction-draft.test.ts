import { describe, expect, test } from "vitest";
import { parsePredictionDraft } from "@keiba-ai-assistant/models/prediction-draft";

describe("parsePredictionDraft", () => {
  test("generatedAt が無くても予想下書きとして解釈できる", () => {
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
      referencedLessons: []
    };

    // Act
    const actual = parsePredictionDraft(value);

    // Assert
    expect(actual.raceId).toBe("fixture-race");
    expect(actual).not.toHaveProperty("generatedAt");
  });
});
