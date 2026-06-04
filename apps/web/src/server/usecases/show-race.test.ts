import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace, type Prediction } from "@keiba-ai-assistant/models";
import { createShowRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/show-race";

describe("createShowRaceUseCase", () => {
  test("保存済みRaceをrace詳細ページpropsに変換できる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const prediction = createPrediction(race.id);
    const showRaceUseCase = createShowRaceUseCase({
      runRepository: {
        findRaceById: async (raceId) => {
          expect(raceId).toBe(race.id);
          return race;
        },
        findPredictionByRaceId: async (raceId) => {
          expect(raceId).toBe(race.id);
          return prediction;
        }
      }
    });

    // Act
    const actual = await showRaceUseCase({ raceId: race.id });

    // Assert
    expect(actual).toEqual({
      raceId: race.id,
      race,
      prediction
    });
  });

  test("Raceが存在しない場合はraceをnullにする", async () => {
    // Arrange
    const raceId = "missing-race";
    const showRaceUseCase = createShowRaceUseCase({
      runRepository: {
        findRaceById: async () => null,
        findPredictionByRaceId: async () => {
          throw new Error("Raceがない場合はpredictionを読まない");
        }
      }
    });

    // Act
    const actual = await showRaceUseCase({ raceId });

    // Assert
    expect(actual).toEqual({
      raceId,
      race: null,
      prediction: null
    });
  });

  test("Predictionが存在しない場合はpredictionをnullにする", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const showRaceUseCase = createShowRaceUseCase({
      runRepository: {
        findRaceById: async () => race,
        findPredictionByRaceId: async () => null
      }
    });

    // Act
    const actual = await showRaceUseCase({ raceId: race.id });

    // Assert
    expect(actual).toEqual({
      raceId: race.id,
      race,
      prediction: null
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
