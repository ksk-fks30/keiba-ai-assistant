import { describe, expect, test } from "vitest";
import { parseBetCandidate } from "@keiba-ai-assistant/models/bet-candidate";

describe("parseBetCandidate", () => {
  test("stakeWeight が整数なら買い目候補として解釈できる", () => {
    // Arrange
    const value = {
      type: "単勝",
      horses: ["fixture-horse-001"],
      reason: "軸として最も安定している。",
      stakeWeight: 25
    };

    // Act
    const actual = parseBetCandidate(value);

    // Assert
    expect(actual.stakeWeight).toBe(25);
  });

  test("stakeWeight が小数なら失敗する", () => {
    // Arrange
    const value = {
      type: "単勝",
      horses: ["fixture-horse-001"],
      reason: "軸として最も安定している。",
      stakeWeight: 0.25
    };

    // Act
    const actual = () => parseBetCandidate(value);

    // Assert
    expect(actual).toThrow();
  });
});
