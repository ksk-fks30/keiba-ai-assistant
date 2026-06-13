import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace, type HorseMemo, type Race } from "@keiba-ai-assistant/models";
import { createSaveHorseMemoUseCase } from "@keiba-ai-assistant/web/server/usecases/save-horse-memo";

describe("createSaveHorseMemoUseCase", () => {
  test("対象レースの出走馬に手動印メモを保存できる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    let savedMemo: HorseMemo | null = null;
    const saveHorseMemoUseCase = createSaveHorseMemoUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async (raceId) => {
          expect(raceId).toBe(race.id);
          return race;
        }
      },
      horseMemoRepository: {
        ...createUnusedHorseMemoRepositoryMethods(),
        saveHorseMemo: async (memo) => {
          savedMemo = memo;
          return memo;
        }
      },
      now: () => new Date("2026-06-07T12:00:00.000Z")
    });

    // Act
    const actual = await saveHorseMemoUseCase({
      raceId: race.id,
      horseId: "fixture-horse-001",
      mark: "◎",
      note: "返し馬を確認する"
    });

    // Assert
    expect(actual).toEqual({
      raceId: race.id,
      horseId: "fixture-horse-001",
      mark: "◎",
      note: "返し馬を確認する",
      createdAt: "2026-06-07T12:00:00.000Z",
      updatedAt: "2026-06-07T12:00:00.000Z"
    });
    expect(savedMemo).toEqual(actual);
  });

  test("markがnullかつnoteが空の場合は対象出走馬のメモを削除する", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    let deletedKey: { raceId: string; horseId: string } | null = null;
    const saveHorseMemoUseCase = createSaveHorseMemoUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async () => race
      },
      horseMemoRepository: {
        ...createUnusedHorseMemoRepositoryMethods(),
        deleteHorseMemo: async (raceId, horseId) => {
          deletedKey = { raceId, horseId };
        }
      }
    });

    // Act
    const actual = await saveHorseMemoUseCase({
      raceId: race.id,
      horseId: "fixture-horse-001",
      mark: null,
      note: ""
    });

    // Assert
    expect(actual).toBeNull();
    expect(deletedKey).toEqual({
      raceId: race.id,
      horseId: "fixture-horse-001"
    });
  });

  test("markがnullでもnoteがある場合はテキストメモとして保存できる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    let savedMemo: HorseMemo | null = null;
    const saveHorseMemoUseCase = createSaveHorseMemoUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async () => race
      },
      horseMemoRepository: {
        ...createUnusedHorseMemoRepositoryMethods(),
        saveHorseMemo: async (memo) => {
          savedMemo = memo;
          return memo;
        }
      },
      now: () => new Date("2026-06-07T12:00:00.000Z")
    });

    // Act
    const actual = await saveHorseMemoUseCase({
      raceId: race.id,
      horseId: "fixture-horse-001",
      mark: null,
      note: "馬場が渋れば相手候補"
    });

    // Assert
    expect(actual).toEqual({
      raceId: race.id,
      horseId: "fixture-horse-001",
      mark: null,
      note: "馬場が渋れば相手候補",
      createdAt: "2026-06-07T12:00:00.000Z",
      updatedAt: "2026-06-07T12:00:00.000Z"
    });
    expect(savedMemo).toEqual(actual);
  });

  test("race.jsonが存在しない場合は保存しない", async () => {
    // Arrange
    const saveHorseMemoUseCase = createSaveHorseMemoUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async () => null
      },
      horseMemoRepository: createUnusedHorseMemoRepositoryMethods()
    });

    // Act
    const actual = saveHorseMemoUseCase({
      raceId: "missing-race",
      horseId: "fixture-horse-001",
      mark: "◯",
      note: ""
    });

    // Assert
    await expect(actual).rejects.toThrow("race.json が見つかりません: missing-race");
  });

  test("対象レースに存在しない馬IDは保存しない", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const saveHorseMemoUseCase = createSaveHorseMemoUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async () => race
      },
      horseMemoRepository: createUnusedHorseMemoRepositoryMethods()
    });

    // Act
    const actual = saveHorseMemoUseCase({
      raceId: race.id,
      horseId: "missing-horse",
      mark: "△",
      note: ""
    });

    // Assert
    await expect(actual).rejects.toThrow(`出走馬が見つかりません: ${race.id}/missing-horse`);
  });
});

/** save-horse-memo usecaseでは使わないRunRepositoryメソッドを失敗スタブとして作る。 */
const createUnusedRunRepositoryMethods = () => {
  return {
    findSavedRaceRuns: async () => {
      throw new Error("手動印保存ではrun一覧を読まない");
    },
    findRaceById: async (): Promise<Race | null> => {
      throw new Error("テストで差し替えていないRace読込が呼ばれました");
    },
    findPredictionByRaceId: async () => {
      throw new Error("手動印保存ではPredictionを読まない");
    },
    findQaEntriesByRaceId: async () => {
      throw new Error("手動印保存ではQ&A履歴を読まない");
    },
    findRaceResultByRaceId: async () => {
      throw new Error("手動印保存ではレース結果を読まない");
    },
    findRaceReflectionByRaceId: async () => {
      throw new Error("手動印保存では振り返りを読まない");
    },
    saveRace: async () => {
      throw new Error("手動印保存ではRaceを保存しない");
    },
    savePrediction: async () => {
      throw new Error("手動印保存ではPredictionを保存しない");
    },
    saveRaceResult: async () => {
      throw new Error("手動印保存ではレース結果を保存しない");
    },
    saveRaceReflection: async () => {
      throw new Error("手動印保存では振り返りを保存しない");
    },
    invalidateAnalysis: async () => {
      throw new Error("手動印保存では既存分析を無効化しない");
    },
    appendQaEntry: async () => {
      throw new Error("手動印保存ではQ&Aを追記しない");
    }
  };
};

/** save-horse-memo usecaseで使わないHorseMemoRepositoryメソッドを失敗スタブとして作る。 */
const createUnusedHorseMemoRepositoryMethods = () => {
  return {
    findHorseMemosByRaceId: async () => {
      throw new Error("手動印保存ではメモ一覧を読まない");
    },
    saveHorseMemo: async () => {
      throw new Error("テストで差し替えていない手動印保存が呼ばれました");
    },
    deleteHorseMemo: async () => {
      throw new Error("テストで差し替えていない手動印削除が呼ばれました");
    }
  };
};
