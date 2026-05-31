import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace } from "@keiba-ai-assistant/models/race";

describe("parseRace", () => {
  test("架空レース fixture を Race モデルとして parse できる", () => {
    // Arrange
    const input = sampleRace;

    // Act
    const actual = parseRace(input);

    // Assert
    expect(actual.id).toBe("fixture-aoba-mile-2026");
    expect(actual.name).toBe("青葉架空マイル");
    expect(actual.horses).toHaveLength(5);
    expect(actual.horses[0]?.pastPerformances).toHaveLength(2);
  });
});
