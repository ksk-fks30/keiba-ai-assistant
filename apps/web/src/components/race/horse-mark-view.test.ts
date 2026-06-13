import { describe, expect, test } from "vitest";
import { horseEvaluationMarks, horseMemoMarks } from "@keiba-ai-assistant/models";
import {
  aiHorseEvaluationMarkSymbols,
  formatAiHorseEvaluationMark,
  horseMemoMarkLabels
} from "@keiba-ai-assistant/web/components/race/horse-mark-view";

describe("formatAiHorseEvaluationMark", () => {
  test("AI評価markを出走馬一覧の印に変換できる", () => {
    // Arrange
    const expected = {
      favorite: "◎",
      second: "◯",
      third: "▲",
      longshot: "△",
      watch: "☆",
      dismiss: "✗"
    };

    // Act
    const actual = Object.fromEntries(
      horseEvaluationMarks.map((mark) => [mark, formatAiHorseEvaluationMark(mark)])
    );

    // Assert
    expect(actual).toEqual(expected);
  });

  test("手動印の全候補に表示ラベルがある", () => {
    // Arrange
    const marks = [...horseMemoMarks];

    // Act
    const actual = marks.map((mark) => horseMemoMarkLabels[mark]);

    // Assert
    expect(actual.every((label) => label.length > 0)).toBe(true);
    expect(Object.values(aiHorseEvaluationMarkSymbols).every((mark) => marks.includes(mark))).toBe(
      true
    );
  });
});
