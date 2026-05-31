import { describe, expect, test } from "vitest";
import { parseRaceDraftPedigree } from "@keiba-ai-assistant/models/race-draft-pedigree";

describe("parseRaceDraftPedigree", () => {
  test("AIが抽出した血統情報を parse できる", () => {
    // Arrange
    const input = {
      sire: "フィクションキング",
      dam: "シラユキメモリー",
      damSire: "マイルクラフト",
      familyNotes: ["芝マイル向きの持続力を示す。"]
    };

    // Act
    const actual = parseRaceDraftPedigree(input);

    // Assert
    expect(actual).toEqual(input);
  });
});
