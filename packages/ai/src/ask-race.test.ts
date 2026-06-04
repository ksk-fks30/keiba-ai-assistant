import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import {
  parsePredictionPolicy,
  parseRace,
  type Prediction,
  type QaEntry
} from "@keiba-ai-assistant/models";
import { askRace } from "@keiba-ai-assistant/ai/ask-race";
import type { CodexJsonRequest, CodexJsonRuntime } from "@keiba-ai-assistant/ai/codex";

describe("askRace", () => {
  test("Codex runtime の回答下書きを QaEntry として返せる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const policy = parsePredictionPolicy({
      path: "policies/main.md",
      content: "芝マイルでは持続力を重視する。",
      loadedAt: "2026-05-31T14:30:00+09:00"
    });
    const prediction = createPrediction(race.id);
    const history = [createQaEntry(race.id, "qa-0001", "本命のリスクは？")];
    const createdAt = "2026-05-31T06:10:00.000Z";
    const requests: CodexJsonRequest[] = [];
    const runtime: CodexJsonRuntime = {
      generateJson: async (request) => {
        requests.push(request);
        return { answer: "本命は折り合い面に注意が必要です。" };
      }
    };

    // Act
    const actual = await askRace({
      race,
      prediction,
      policy,
      history,
      question: "本命のリスクをもう一度整理して",
      model: "fixture-codex-model",
      now: () => new Date(createdAt),
      runtime
    });

    // Assert
    expect(actual).toEqual({
      id: "qa-0002-20260531061000000",
      raceId: race.id,
      question: "本命のリスクをもう一度整理して",
      answer: "本命は折り合い面に注意が必要です。",
      createdAt
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.prompt).toContain("芝マイルでは持続力を重視する。");
    expect(requests[0]?.prompt).toContain("本命のリスクは？");
    expect(requests[0]?.prompt).toContain("本命のリスクをもう一度整理して");
    expect(requests[0]?.model).toBe("fixture-codex-model");
    expect(JSON.stringify(requests[0]?.outputSchema)).toContain("answer");
    expect(JSON.stringify(requests[0]?.outputSchema)).not.toContain("createdAt");
  });

  test("Codex runtime の出力が回答下書きでなければ失敗する", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const policy = parsePredictionPolicy({
      path: "policies/main.md",
      content: "芝マイルでは持続力を重視する。",
      loadedAt: "2026-05-31T14:30:00+09:00"
    });
    const runtime: CodexJsonRuntime = {
      generateJson: async () => {
        return { message: "invalid" };
      }
    };

    // Act
    const actual = askRace({
      race,
      prediction: createPrediction(race.id),
      policy,
      history: [],
      question: "本命のリスクは？",
      runtime
    });

    // Assert
    await expect(actual).rejects.toThrow();
  });

  test("回答本文がJSON文字列の場合は本文だけを保存用 QaEntry にできる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const policy = parsePredictionPolicy({
      path: "policies/main.md",
      content: "芝マイルでは持続力を重視する。",
      loadedAt: "2026-05-31T14:30:00+09:00"
    });
    const runtime: CodexJsonRuntime = {
      generateJson: async () => {
        return { answer: JSON.stringify({ answer: "買い目を大きく変える必要はありません。" }) };
      }
    };

    // Act
    const actual = await askRace({
      race,
      prediction: createPrediction(race.id),
      policy,
      history: [],
      question: "買い目を変えるべき？",
      now: () => new Date("2026-05-31T06:10:00.000Z"),
      runtime
    });

    // Assert
    expect(actual.answer).toBe("買い目を大きく変える必要はありません。");
  });

  test("timeoutMsを指定した場合はCodex runtimeへAbortSignalを渡せる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const policy = parsePredictionPolicy({
      path: "policies/main.md",
      content: "芝マイルでは持続力を重視する。",
      loadedAt: "2026-05-31T14:30:00+09:00"
    });
    let actualSignal: AbortSignal | undefined;
    const runtime: CodexJsonRuntime = {
      generateJson: async (request) => {
        actualSignal = request.signal;
        return { answer: "タイムアウト前に回答できました。" };
      }
    };

    // Act
    const actual = await askRace({
      race,
      prediction: createPrediction(race.id),
      policy,
      history: [],
      question: "相手候補は？",
      timeoutMs: 1_000,
      now: () => new Date("2026-05-31T06:10:00.000Z"),
      runtime
    });

    // Assert
    expect(actual.answer).toBe("タイムアウト前に回答できました。");
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
    const actual = askRace({
      race,
      prediction: createPrediction(race.id),
      policy,
      history: [],
      question: "相手候補は？",
      timeoutMs: 10,
      runtime
    });

    // Assert
    await expect(actual).rejects.toThrow("1 秒以内に完了しませんでした");
    expect(actualSignal?.aborted).toBe(true);
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
        stakeWeight: 100
      }
    ],
    generatedAt: "2026-05-31T05:40:00.000Z"
  };
};

/** テストで使う最小限の QaEntry fixture を作る。 */
const createQaEntry = (raceId: string, id: string, question: string): QaEntry => {
  return {
    id,
    raceId,
    question,
    answer: `${question} に対するfixture回答。`,
    createdAt: "2026-05-31T06:00:00.000Z"
  };
};
