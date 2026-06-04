import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace, type Prediction, type QaEntry } from "@keiba-ai-assistant/models";
import { createShowRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/show-race";

describe("createShowRaceUseCase", () => {
  test("保存済みRaceをrace詳細ページpropsに変換できる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const prediction = createPrediction(race.id);
    const qaEntries = [createQaEntry(race.id, "qa-fixture-001", "本命のリスクは？")];
    const showRaceUseCase = createShowRaceUseCase({
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
          return qaEntries;
        },
        appendQaEntry: async () => {
          throw new Error("詳細表示ではQ&Aを追記しない");
        }
      }
    });

    // Act
    const actual = await showRaceUseCase({ raceId: race.id });

    // Assert
    expect(actual).toEqual({
      raceId: race.id,
      race,
      prediction,
      qaEntries,
      askError: null
    });
  });

  test("追加質問エラーがある場合はpropsに含める", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const askError = "Codexの実行に失敗しました。";
    const showRaceUseCase = createShowRaceUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async () => race,
        findPredictionByRaceId: async () => null,
        findQaEntriesByRaceId: async () => [],
        appendQaEntry: async () => {
          throw new Error("詳細表示ではQ&Aを追記しない");
        }
      }
    });

    // Act
    const actual = await showRaceUseCase({ raceId: race.id, askError });

    // Assert
    expect(actual).toEqual({
      raceId: race.id,
      race,
      prediction: null,
      qaEntries: [],
      askError
    });
  });

  test("Raceが存在しない場合はraceをnullにする", async () => {
    // Arrange
    const raceId = "missing-race";
    const showRaceUseCase = createShowRaceUseCase({
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
          throw new Error("詳細表示ではQ&Aを追記しない");
        }
      }
    });

    // Act
    const actual = await showRaceUseCase({ raceId });

    // Assert
    expect(actual).toEqual({
      raceId,
      race: null,
      prediction: null,
      qaEntries: [],
      askError: null
    });
  });

  test("Predictionが存在しない場合はpredictionをnullにする", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const showRaceUseCase = createShowRaceUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async () => race,
        findPredictionByRaceId: async () => null,
        findQaEntriesByRaceId: async () => [],
        appendQaEntry: async () => {
          throw new Error("詳細表示ではQ&Aを追記しない");
        }
      }
    });

    // Act
    const actual = await showRaceUseCase({ raceId: race.id });

    // Assert
    expect(actual).toEqual({
      raceId: race.id,
      race,
      prediction: null,
      qaEntries: [],
      askError: null
    });
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

/** 詳細表示usecaseでは使わないRunRepositoryメソッドを失敗スタブとして作る。 */
const createUnusedRunRepositoryMethods = () => {
  return {
    findSavedRaceRuns: async () => {
      throw new Error("詳細表示ではrun一覧を読まない");
    },
    saveRace: async () => {
      throw new Error("詳細表示ではRaceを保存しない");
    },
    savePrediction: async () => {
      throw new Error("詳細表示ではPredictionを保存しない");
    },
    invalidateAnalysis: async () => {
      throw new Error("詳細表示では既存分析を無効化しない");
    }
  };
};
