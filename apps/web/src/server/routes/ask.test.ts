import { describe, expect, test } from "vitest";
import type { QaEntry } from "@keiba-ai-assistant/models";
import { createAskRoutes } from "@keiba-ai-assistant/web/server/routes/ask";
import type { AskRaceUseCaseInput } from "@keiba-ai-assistant/web/server/usecases/ask-race";

describe("createAskRoutes", () => {
  test("フォームの質問をusecaseへ渡してレース詳細へredirectする", async () => {
    // Arrange
    const raceId = "fixture-race";
    let actualInput: AskRaceUseCaseInput | null = null;
    const routes = createAskRoutes({
      askRaceUseCase: async (input) => {
        actualInput = input;
        return createQaEntry(raceId);
      }
    });
    const formData = new FormData();
    formData.set("question", "本命のリスクは？");

    // Act
    const response = await routes.request(`/races/${raceId}/ask`, {
      method: "POST",
      body: formData
    });

    // Assert
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/races/${raceId}`);
    expect(actualInput).toEqual({
      raceId,
      question: "本命のリスクは？"
    });
  });

  test("JSONの質問をusecaseへ渡してレース詳細へredirectする", async () => {
    // Arrange
    const raceId = "fixture-race";
    let actualInput: AskRaceUseCaseInput | null = null;
    const routes = createAskRoutes({
      askRaceUseCase: async (input) => {
        actualInput = input;
        return createQaEntry(raceId);
      }
    });

    // Act
    const response = await routes.request(`/races/${raceId}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "展開面の不安は？" })
    });

    // Assert
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/races/${raceId}`);
    expect(actualInput).toEqual({
      raceId,
      question: "展開面の不安は？"
    });
  });

  test("usecaseが失敗した場合はエラー付きでレース詳細へredirectする", async () => {
    // Arrange
    const raceId = "fixture-race";
    const routes = createAskRoutes({
      askRaceUseCase: async () => {
        throw new Error("Codexの実行に失敗しました。");
      }
    });

    // Act
    const response = await routes.request(`/races/${raceId}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "展開面の不安は？" })
    });

    // Assert
    const location = response.headers.get("location");
    expect(response.status).toBe(303);
    expect(location).not.toBeNull();
    expect(new URL(location ?? "", "http://localhost").pathname).toBe(`/races/${raceId}`);
    expect(new URL(location ?? "", "http://localhost").searchParams.get("askError")).toBe(
      "Codexの実行に失敗しました。"
    );
  });
});

/** route テスト用の最小限の QaEntry fixture を作る。 */
const createQaEntry = (raceId: string): QaEntry => {
  return {
    id: "qa-fixture-001",
    raceId,
    question: "本命のリスクは？",
    answer: "展開が速くなりすぎる点です。",
    createdAt: "2026-05-31T06:10:00.000Z"
  };
};
