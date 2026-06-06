import { describe, expect, test } from "vitest";
import { parsePedigree } from "@keiba-ai-assistant/models/pedigree";

describe("parsePedigree", () => {
  test("血統ページ由来の系統情報を parse できる", () => {
    // Arrange
    const input = {
      sire: "フィクションキング",
      dam: "シラユキメモリー",
      damSire: "マイルクラフト",
      sireLine: "フィクション系",
      damSireLine: "マイル系",
      femaleFamily: "FNo.[7-f]",
      familyNotes: ["芝マイル向きの持続力を示す。"]
    };

    // Act
    const actual = parsePedigree(input);

    // Assert
    expect(actual).toEqual(input);
  });

  test("系統情報が未取得でも既存の血統情報を parse できる", () => {
    // Arrange
    const input = {
      sire: "フィクションキング",
      dam: "シラユキメモリー",
      damSire: "マイルクラフト",
      familyNotes: []
    };

    // Act
    const actual = parsePedigree(input);

    // Assert
    expect(actual).toEqual(input);
  });
});
