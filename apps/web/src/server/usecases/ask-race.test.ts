import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import type { AskRaceInput } from "@keiba-ai-assistant/ai";
import {
  parseRace,
  type Prediction,
  type PredictionPolicy,
  type QaEntry
} from "@keiba-ai-assistant/models";
import { createAskRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/ask-race";

describe("createAskRaceUseCase", () => {
  test("保存済みデータと質問をAIへ渡してQaEntryを追記できる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const prediction = createPrediction(race.id);
    const history = [createQaEntry(race.id, "qa-fixture-001", "本命のリスクは？")];
    const policy = createPredictionPolicy();
    const generatedEntry = createQaEntry(race.id, "qa-fixture-002", "相手候補は？");
    const appendedEntries: QaEntry[] = [];
    let actualAskRaceInput: AskRaceInput | null = null;
    const askRaceUseCase = createAskRaceUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async (raceId) => {
          expect(raceId).toBe(race.id);
          return race;
        },
        findPredictionByRaceId: async (raceId) => {
          expect(raceId).toBe(race.id);
          return prediction;
        },
        findQaEntriesByRaceId: async (raceId) => {
          expect(raceId).toBe(race.id);
          return history;
        },
        appendQaEntry: async (entry) => {
          appendedEntries.push(entry);
        }
      },
      policyRepository: {
        readPredictionPolicy: async () => policy
      },
      askRace: async (input) => {
        actualAskRaceInput = input;
        return generatedEntry;
      },
      timeoutMs: 30_000
    });

    // Act
    const actual = await askRaceUseCase({
      raceId: race.id,
      question: "  相手候補は？  "
    });

    // Assert
    expect(actual).toEqual(generatedEntry);
    expect(appendedEntries).toEqual([generatedEntry]);
    expect(actualAskRaceInput).toEqual({
      race,
      prediction,
      policy,
      history,
      question: "相手候補は？",
      timeoutMs: 30_000
    });
  });

  test("race.jsonが存在しない場合は質問を実行しない", async () => {
    // Arrange
    const raceId = "missing-race";
    const askRaceUseCase = createAskRaceUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async () => null,
        findPredictionByRaceId: async () => {
          throw new Error("Raceがない場合はpredictionを読まない");
        },
        findQaEntriesByRaceId: async () => {
          throw new Error("Raceがない場合はQ&A履歴を読まない");
        },
        appendQaEntry: async () => {
          throw new Error("Raceがない場合はQ&Aを追記しない");
        }
      },
      policyRepository: {
        readPredictionPolicy: async () => {
          throw new Error("Raceがない場合は予想方針を読まない");
        }
      },
      askRace: async () => {
        throw new Error("Raceがない場合はAIを実行しない");
      }
    });

    // Act
    const actual = askRaceUseCase({ raceId, question: "相手候補は？" });

    // Assert
    await expect(actual).rejects.toThrow(`race.json が見つかりません: ${raceId}`);
  });

  test("prediction.jsonが存在しない場合は質問を実行しない", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const askRaceUseCase = createAskRaceUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async () => race,
        findPredictionByRaceId: async () => null,
        findQaEntriesByRaceId: async () => {
          throw new Error("Predictionがない場合はQ&A履歴を読まない");
        },
        appendQaEntry: async () => {
          throw new Error("Predictionがない場合はQ&Aを追記しない");
        }
      },
      policyRepository: {
        readPredictionPolicy: async () => {
          throw new Error("Predictionがない場合は予想方針を読まない");
        }
      },
      askRace: async () => {
        throw new Error("Predictionがない場合はAIを実行しない");
      }
    });

    // Act
    const actual = askRaceUseCase({ raceId: race.id, question: "相手候補は？" });

    // Assert
    await expect(actual).rejects.toThrow(`prediction.json が見つかりません: ${race.id}`);
  });

  test("質問が空の場合は質問を実行しない", async () => {
    // Arrange
    const askRaceUseCase = createAskRaceUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async () => {
          throw new Error("空質問では保存済みレースを読まない");
        },
        findPredictionByRaceId: async () => {
          throw new Error("空質問ではpredictionを読まない");
        },
        findQaEntriesByRaceId: async () => {
          throw new Error("空質問ではQ&A履歴を読まない");
        },
        appendQaEntry: async () => {
          throw new Error("空質問ではQ&Aを追記しない");
        }
      },
      policyRepository: {
        readPredictionPolicy: async () => {
          throw new Error("空質問では予想方針を読まない");
        }
      },
      askRace: async () => {
        throw new Error("空質問ではAIを実行しない");
      }
    });

    // Act
    const actual = askRaceUseCase({ raceId: "fixture-race", question: "   " });

    // Assert
    await expect(actual).rejects.toThrow("質問を入力してください。");
  });
});

/** usecase テスト用の最小限の Prediction fixture を作る。 */
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
        reason: "能力評価が最上位。",
        stakeWeight: 60
      }
    ],
    referencedLessons: [],
    generatedAt: "2026-05-31T05:40:00.000Z"
  };
};

/** usecase テスト用の最小限の QaEntry fixture を作る。 */
const createQaEntry = (raceId: string, id: string, question: string): QaEntry => {
  return {
    id,
    raceId,
    question,
    answer: `${question}への回答です。`,
    createdAt: "2026-05-31T06:10:00.000Z"
  };
};

/** usecase テスト用の最小限の PredictionPolicy fixture を作る。 */
const createPredictionPolicy = (): PredictionPolicy => {
  return {
    path: "/tmp/policies/main.md",
    content: "架空レースでは先行力を重視する。",
    loadedAt: "2026-05-31T05:00:00.000Z"
  };
};

/** 追加質問usecaseでは使わないRunRepositoryメソッドを失敗スタブとして作る。 */
const createUnusedRunRepositoryMethods = () => {
  return {
    findSavedRaceRuns: async () => {
      throw new Error("追加質問ではrun一覧を読まない");
    },
    saveRace: async () => {
      throw new Error("追加質問ではRaceを保存しない");
    },
    savePrediction: async () => {
      throw new Error("追加質問ではPredictionを保存しない");
    },
    findRaceResultByRaceId: async () => {
      throw new Error("追加質問ではレース結果を読まない");
    },
    findRaceReflectionByRaceId: async () => {
      throw new Error("追加質問では振り返りを読まない");
    },
    saveRaceResult: async () => {
      throw new Error("追加質問ではレース結果を保存しない");
    },
    saveRaceReflection: async () => {
      throw new Error("追加質問では振り返りを保存しない");
    },
    invalidateAnalysis: async () => {
      throw new Error("追加質問では既存分析を無効化しない");
    }
  };
};
