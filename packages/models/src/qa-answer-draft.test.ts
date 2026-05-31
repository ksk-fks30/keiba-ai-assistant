import { describe, expect, test } from "vitest";
import { parseQaAnswerDraft } from "@keiba-ai-assistant/models/qa-answer-draft";

describe("parseQaAnswerDraft", () => {
  test("回答本文だけを Q&A 回答下書きとして解釈できる", () => {
    // Arrange
    const value = {
      answer: "シラユキコードは同条件実績を最重視して本命です。"
    };

    // Act
    const actual = parseQaAnswerDraft(value);

    // Assert
    expect(actual.answer).toBe("シラユキコードは同条件実績を最重視して本命です。");
  });
});
