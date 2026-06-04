import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace } from "@keiba-ai-assistant/models";
import type { SavedRaceRun } from "@keiba-ai-assistant/web/server/repositories/run-repository";
import { createShowHomeUseCase } from "@keiba-ai-assistant/web/server/usecases/show-home";

describe("createShowHomeUseCase", () => {
  test("保存済みrunを開催日時の新しい順で返す", async () => {
    // Arrange
    const oldRun = createSavedRaceRun({
      raceId: "old-race",
      race: createRace({
        id: "old-race",
        name: "古い開催レース",
        startTime: "2026-06-07T12:00:00+09:00"
      }),
      updatedAt: "2026-06-04T10:00:00.000Z"
    });
    const newRun = createSavedRaceRun({
      raceId: "new-race",
      race: createRace({
        id: "new-race",
        name: "新しい開催レース",
        startTime: "2026-06-08T12:00:00+09:00"
      }),
      updatedAt: "2026-06-03T10:00:00.000Z"
    });
    const showHomeUseCase = createShowHomeUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findSavedRaceRuns: async () => [oldRun, newRun]
      }
    });

    // Act
    const actual = await showHomeUseCase();

    // Assert
    expect(actual).toEqual({
      runs: [newRun, oldRun]
    });
  });
});

/** トップ画面usecaseテスト用の保存済みrunを作る。 */
const createSavedRaceRun = (input: {
  raceId: string;
  updatedAt: string;
  race?: SavedRaceRun["race"] | undefined;
}): SavedRaceRun => {
  return {
    raceId: input.raceId,
    race: input.race ?? null,
    hasPrediction: input.race !== undefined,
    hasQa: false,
    updatedAt: input.updatedAt
  };
};

/** トップ画面usecaseテスト用のRaceを作る。 */
const createRace = (input: { id: string; name: string; startTime: string }) => {
  return parseRace({
    ...sampleRace,
    id: input.id,
    name: input.name,
    startTime: input.startTime
  });
};

/** トップ画面表示では使わないRunRepositoryメソッドを失敗スタブとして作る。 */
const createUnusedRunRepositoryMethods = () => {
  return {
    findRaceById: async () => {
      throw new Error("トップ画面表示では個別Raceを読まない");
    },
    findPredictionByRaceId: async () => {
      throw new Error("トップ画面表示では個別Predictionを読まない");
    },
    findQaEntriesByRaceId: async () => {
      throw new Error("トップ画面表示ではQ&A履歴を読まない");
    },
    saveRace: async () => {
      throw new Error("トップ画面表示ではRaceを保存しない");
    },
    savePrediction: async () => {
      throw new Error("トップ画面表示ではPredictionを保存しない");
    },
    invalidateAnalysis: async () => {
      throw new Error("トップ画面表示では既存分析を無効化しない");
    },
    appendQaEntry: async () => {
      throw new Error("トップ画面表示ではQ&Aを追記しない");
    }
  };
};
