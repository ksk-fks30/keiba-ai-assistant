import { describe, expect, test } from "vitest";
import { parseLessonEntry } from "@keiba-ai-assistant/models/lesson-entry";

describe("parseLessonEntry", () => {
  test("反省から抽出したLessonをparseできる", () => {
    // Arrange
    const value = {
      id: "lesson-fixture-001",
      sourceRaceId: "fixture-aoba-mile-2026",
      status: "approved",
      title: "前残り傾向では人気薄先行馬を残す",
      situationKey: "芝1600m・前残り・人気薄先行馬",
      tags: ["芝", "1600m", "前残り", "人気薄", "先行"],
      diaryText: "架空レースでは前が止まりにくい馬場で先行馬を軽視した。",
      decisionGuidance: "前残り傾向が明確な場合は、人気薄でも先行力を相手評価に残す。",
      applicableWhen: ["前が止まりにくい馬場", "同型逃げ馬が少ない"],
      notApplicableWhen: ["差しが届く馬場", "同型先行馬が多い"],
      confidence: "medium",
      createdAt: "2026-06-06T12:00:00.000Z",
      updatedAt: "2026-06-06T12:00:00.000Z"
    };

    // Act
    const actual = parseLessonEntry(value);

    // Assert
    expect(actual.id).toBe("lesson-fixture-001");
    expect(actual.status).toBe("approved");
    expect(actual.tags).toContain("前残り");
  });
});
