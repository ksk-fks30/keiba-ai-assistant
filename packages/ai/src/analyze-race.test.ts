import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parsePredictionPolicy, parseRace, type Prediction } from "@keiba-ai-assistant/models";
import { analyzeRace } from "@keiba-ai-assistant/ai/analyze-race";
import type {
  CodexRaceAnalysisRequest,
  CodexRaceAnalysisRuntime
} from "@keiba-ai-assistant/ai/codex";

describe("analyzeRace", () => {
  test("Codex runtime の出力を Prediction として返せる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const policy = parsePredictionPolicy({
      path: "policies/main.md",
      content: "芝マイルでは持続力を重視する。",
      loadedAt: "2026-05-31T14:30:00+09:00"
    });
    const prediction = createPrediction(race.id);
    const requests: CodexRaceAnalysisRequest[] = [];
    const runtime: CodexRaceAnalysisRuntime = {
      generatePrediction: async (request) => {
        requests.push(request);
        return prediction;
      }
    };

    // Act
    const actual = await analyzeRace({
      race,
      policy,
      model: "fixture-codex-model",
      runtime
    });

    // Assert
    expect(actual).toEqual(prediction);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.prompt).toContain("芝マイルでは持続力を重視する。");
    expect(requests[0]?.prompt).toContain(race.id);
    expect(requests[0]?.model).toBe("fixture-codex-model");
    expect(JSON.stringify(requests[0]?.outputSchema)).toContain("favorite");
  });

  test("Codex runtime の出力が Prediction でなければ失敗する", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const policy = parsePredictionPolicy({
      path: "policies/main.md",
      content: "芝マイルでは持続力を重視する。",
      loadedAt: "2026-05-31T14:30:00+09:00"
    });
    const runtime: CodexRaceAnalysisRuntime = {
      generatePrediction: async () => {
        return { raceId: race.id };
      }
    };

    // Act
    const actual = analyzeRace({ race, policy, runtime });

    // Assert
    await expect(actual).rejects.toThrow();
  });
});

/** テストで使う最小限の Prediction fixture を作る。 */
const createPrediction = (raceId: string): Prediction => {
  return {
    raceId,
    summary: "架空レースでは先行力と持続力を重視する。",
    evaluations: [
      {
        horseId: "fixture-horse-001",
        mark: "favorite",
        score: 88,
        reasons: ["芝マイルで安定している。"],
        risks: ["展開が速くなりすぎる可能性がある。"]
      }
    ],
    betCandidates: [
      {
        type: "単勝",
        horses: ["fixture-horse-001"],
        reason: "軸として最も安定している。",
        stakeWeight: 40
      }
    ],
    generatedAt: "2026-05-31T14:40:00+09:00",
    model: "fixture-codex-model"
  };
};
