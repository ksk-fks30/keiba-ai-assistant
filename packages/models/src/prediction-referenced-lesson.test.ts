import { describe, expect, test } from "vitest";
import { parsePredictionReferencedLesson } from "@keiba-ai-assistant/models/prediction-referenced-lesson";

describe("parsePredictionReferencedLesson", () => {
  test("予想時に採用したLesson参照をparseできる", () => {
    // Arrange
    const value = {
      lessonId: "lesson-fixture-001",
      title: "前残り傾向では人気薄先行馬を残す",
      reason: "今回も前が止まりにくい条件に近いため。"
    };

    // Act
    const actual = parsePredictionReferencedLesson(value);

    // Assert
    expect(actual.lessonId).toBe("lesson-fixture-001");
    expect(actual.reason).toContain("前が止まりにくい");
  });
});
