import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import {
  parsePredictionPolicy,
  parseRace,
  type Prediction,
  type PredictionDraft
} from "@keiba-ai-assistant/models";
import { analyzeRace } from "@keiba-ai-assistant/ai/analyze-race";
import type { CodexJsonRequest, CodexJsonRuntime } from "@keiba-ai-assistant/ai/codex";

describe("analyzeRace", () => {
  test("Codex runtime の出力を Prediction として返せる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const policy = parsePredictionPolicy({
      path: "policies/main.md",
      content: "芝マイルでは持続力を重視する。",
      loadedAt: "2026-05-31T14:30:00+09:00"
    });
    const generatedAt = "2026-05-31T05:40:00.000Z";
    const predictionDraft = createPredictionDraft(race.id);
    const prediction = createPrediction(race.id, generatedAt);
    const requests: CodexJsonRequest[] = [];
    const runtime: CodexJsonRuntime = {
      generateJson: async (request) => {
        requests.push(request);
        return predictionDraft;
      }
    };

    // Act
    const actual = await analyzeRace({
      race,
      policy,
      model: "fixture-codex-model",
      now: () => new Date(generatedAt),
      runtime
    });

    // Assert
    expect(actual).toEqual(prediction);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.prompt).toContain("芝マイルでは持続力を重視する。");
    expect(requests[0]?.prompt).toContain(race.id);
    expect(requests[0]?.model).toBe("fixture-codex-model");
    expect(JSON.stringify(requests[0]?.outputSchema)).toContain("favorite");
    expect(JSON.stringify(requests[0]?.outputSchema)).not.toContain("generatedAt");
  });

  test("Codex runtime の出力が Prediction でなければ失敗する", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const policy = parsePredictionPolicy({
      path: "policies/main.md",
      content: "芝マイルでは持続力を重視する。",
      loadedAt: "2026-05-31T14:30:00+09:00"
    });
    const runtime: CodexJsonRuntime = {
      generateJson: async () => {
        return { raceId: race.id };
      }
    };

    // Act
    const actual = analyzeRace({ race, policy, runtime });

    // Assert
    await expect(actual).rejects.toThrow();
  });

  test("timeoutMsを指定した場合はCodex runtimeへAbortSignalを渡せる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const policy = parsePredictionPolicy({
      path: "policies/main.md",
      content: "芝マイルでは持続力を重視する。",
      loadedAt: "2026-05-31T14:30:00+09:00"
    });
    const predictionDraft = createPredictionDraft(race.id);
    let actualSignal: AbortSignal | undefined;
    const runtime: CodexJsonRuntime = {
      generateJson: async (request) => {
        actualSignal = request.signal;
        return predictionDraft;
      }
    };

    // Act
    const actual = await analyzeRace({
      race,
      policy,
      timeoutMs: 1_000,
      runtime
    });

    // Assert
    expect(actual.raceId).toBe(race.id);
    expect(actualSignal).toBeInstanceOf(AbortSignal);
    expect(actualSignal?.aborted).toBe(false);
  });

  test("Codex runtimeが返らない場合はtimeoutMsで失敗する", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const policy = parsePredictionPolicy({
      path: "policies/main.md",
      content: "芝マイルでは持続力を重視する。",
      loadedAt: "2026-05-31T14:30:00+09:00"
    });
    let actualSignal: AbortSignal | undefined;
    const runtime: CodexJsonRuntime = {
      generateJson: (request) => {
        actualSignal = request.signal;
        return new Promise(() => {});
      }
    };

    // Act
    const actual = analyzeRace({
      race,
      policy,
      timeoutMs: 10,
      runtime
    });

    // Assert
    await expect(actual).rejects.toThrow("1 秒以内に完了しませんでした");
    expect(actualSignal?.aborted).toBe(true);
  });
});

/** テストで使う最小限の PredictionDraft fixture を作る。 */
const createPredictionDraft = (raceId: string): PredictionDraft => {
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
    ]
  };
};

/** テストで使う最小限の Prediction fixture を作る。 */
const createPrediction = (raceId: string, generatedAt: string): Prediction => {
  return { ...createPredictionDraft(raceId), generatedAt };
};
