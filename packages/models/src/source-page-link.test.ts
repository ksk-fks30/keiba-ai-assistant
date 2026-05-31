import { describe, expect, test } from "vitest";
import { parseSourcePageLink } from "@keiba-ai-assistant/models/source-page-link";

describe("parseSourcePageLink", () => {
  test("ページ内リンクsnapshotを parse できる", () => {
    // Arrange
    const input = {
      text: "シラユキコード",
      href: "https://example.test/horse/fixture-horse-001"
    };

    // Act
    const actual = parseSourcePageLink(input);

    // Assert
    expect(actual).toEqual(input);
  });
});
