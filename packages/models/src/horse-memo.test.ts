import { describe, expect, test } from "vitest";
import { horseMemoMarks, parseHorseMemo } from "@keiba-ai-assistant/models/horse-memo";

describe("parseHorseMemo", () => {
  test("Webの手動印メモをparseできる", () => {
    // Arrange
    const input = {
      raceId: "fixture-aoba-mile-2026",
      horseId: "fixture-horse-001",
      mark: "◎",
      note: "返し馬の気配を確認する",
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
        note: "",
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
        note: "",
        createdAt: "2026-06-07T12:00:00.000Z",
        updatedAt: "2026-06-07T12:00:00.000Z"
      })
    ).toThrow();
  });

  test("手動印なしのテキストメモをparseできる", () => {
    // Arrange
    const input = {
      raceId: "fixture-aoba-mile-2026",
      horseId: "fixture-horse-001",
      mark: null,
      note: "馬場が渋れば相手に残す",
      createdAt: "2026-06-07T12:00:00.000Z",
      updatedAt: "2026-06-07T12:00:00.000Z"
    };

    // Act
    const actual = parseHorseMemo(input);

    // Assert
    expect(actual).toEqual(input);
  });
});
