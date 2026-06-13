import { describe, expect, test } from "vitest";
import { horseMemoMarks, parseHorseMemo } from "@keiba-ai-assistant/models/horse-memo";

describe("parseHorseMemo", () => {
  test("Webの手動印メモをparseできる", () => {
    // Arrange
    const input = {
      raceId: "fixture-aoba-mile-2026",
      horseId: "fixture-horse-001",
      mark: "◎",
      createdAt: "2026-06-07T12:00:00.000Z",
      updatedAt: "2026-06-07T12:00:00.000Z"
    };

    // Act
    const actual = parseHorseMemo(input);

    // Assert
    expect(actual).toEqual(input);
  });

  test("定義済みの手動印だけを許可する", () => {
    // Arrange
    const marks = [...horseMemoMarks];

    // Act
    const actual = marks.map((mark) =>
      parseHorseMemo({
        raceId: "fixture-aoba-mile-2026",
        horseId: `fixture-horse-${mark}`,
        mark,
        createdAt: "2026-06-07T12:00:00.000Z",
        updatedAt: "2026-06-07T12:00:00.000Z"
      })
    );

    // Assert
    expect(actual.map((memo) => memo.mark)).toEqual(marks);
    expect(() =>
      parseHorseMemo({
        raceId: "fixture-aoba-mile-2026",
        horseId: "fixture-horse-invalid",
        mark: "注",
        createdAt: "2026-06-07T12:00:00.000Z",
        updatedAt: "2026-06-07T12:00:00.000Z"
      })
    ).toThrow();
  });
});
