import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace, type HorseMemo, type Race } from "@keiba-ai-assistant/models";
import {
  createSaveHorseMemoMarkUseCase,
  createSaveHorseMemoNoteUseCase
} from "@keiba-ai-assistant/web/server/usecases/save-horse-memo";
import type { WriteHorseMemoMarkInput, WriteHorseMemoNoteInput } from "@keiba-ai-assistant/storage";

describe("createSaveHorseMemoMarkUseCase", () => {
  test("対象レースの出走馬に手動印だけを保存できる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    let savedInput: WriteHorseMemoMarkInput | null = null;
    const saveHorseMemoMarkUseCase = createSaveHorseMemoMarkUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async (raceId) => {
          expect(raceId).toBe(race.id);
          return race;
        }
      },
      horseMemoRepository: {
        ...createUnusedHorseMemoRepositoryMethods(),
        saveHorseMemoMark: async (input) => {
          savedInput = input;
          return createHorseMemo(input.raceId, input.horseId, input.mark, "");
        }
      },
      now: () => new Date("2026-06-07T12:00:00.000Z")
    });

    // Act
    const actual = await saveHorseMemoMarkUseCase({
      raceId: race.id,
      horseId: "fixture-horse-001",
      mark: "◎"
    });

    // Assert
    expect(savedInput).toEqual({
      raceId: race.id,
      horseId: "fixture-horse-001",
      mark: "◎",
      createdAt: "2026-06-07T12:00:00.000Z",
      updatedAt: "2026-06-07T12:00:00.000Z"
    });
    expect(actual?.mark).toBe("◎");
  });

  test("race.jsonが存在しない場合は手動印を保存しない", async () => {
    // Arrange
    const saveHorseMemoMarkUseCase = createSaveHorseMemoMarkUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async () => null
      },
      horseMemoRepository: createUnusedHorseMemoRepositoryMethods()
    });

    // Act
    const actual = saveHorseMemoMarkUseCase({
      raceId: "missing-race",
      horseId: "fixture-horse-001",
      mark: "◯"
    });

    // Assert
    await expect(actual).rejects.toThrow("race.json が見つかりません: missing-race");
  });

  test("対象レースに存在しない馬IDは手動印を保存しない", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const saveHorseMemoMarkUseCase = createSaveHorseMemoMarkUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async () => race
      },
      horseMemoRepository: createUnusedHorseMemoRepositoryMethods()
    });

    // Act
    const actual = saveHorseMemoMarkUseCase({
      raceId: race.id,
      horseId: "missing-horse",
      mark: "△"
    });

    // Assert
    await expect(actual).rejects.toThrow(`出走馬が見つかりません: ${race.id}/missing-horse`);
  });
});

describe("createSaveHorseMemoNoteUseCase", () => {
  test("対象レースの出走馬にテキストメモだけを保存できる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    let savedInput: WriteHorseMemoNoteInput | null = null;
    const saveHorseMemoNoteUseCase = createSaveHorseMemoNoteUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async (raceId) => {
          expect(raceId).toBe(race.id);
          return race;
        }
      },
      horseMemoRepository: {
        ...createUnusedHorseMemoRepositoryMethods(),
        saveHorseMemoNote: async (input) => {
          savedInput = input;
          return createHorseMemo(input.raceId, input.horseId, null, input.note);
        }
      },
      now: () => new Date("2026-06-07T12:00:00.000Z")
    });

    // Act
    const actual = await saveHorseMemoNoteUseCase({
      raceId: race.id,
      horseId: "fixture-horse-001",
      note: "返し馬を確認する"
    });

    // Assert
    expect(savedInput).toEqual({
      raceId: race.id,
      horseId: "fixture-horse-001",
      note: "返し馬を確認する",
      createdAt: "2026-06-07T12:00:00.000Z",
      updatedAt: "2026-06-07T12:00:00.000Z"
    });
    expect(actual?.note).toBe("返し馬を確認する");
  });
});

/** save-horse-memo usecaseでは使わないRunRepositoryメソッドを失敗スタブとして作る。 */
const createUnusedRunRepositoryMethods = () => {
  return {
    findSavedRaceRuns: async () => {
      throw new Error("出走馬メモ保存ではrun一覧を読まない");
    },
    findRaceById: async (): Promise<Race | null> => {
      throw new Error("テストで差し替えていないRace読込が呼ばれました");
    },
    findPredictionByRaceId: async () => {
      throw new Error("出走馬メモ保存ではPredictionを読まない");
    },
    findQaEntriesByRaceId: async () => {
      throw new Error("出走馬メモ保存ではQ&A履歴を読まない");
    },
    findRaceResultByRaceId: async () => {
      throw new Error("出走馬メモ保存ではレース結果を読まない");
    },
    findRaceReflectionByRaceId: async () => {
      throw new Error("出走馬メモ保存では振り返りを読まない");
    },
    saveRace: async () => {
      throw new Error("出走馬メモ保存ではRaceを保存しない");
    },
    savePrediction: async () => {
      throw new Error("出走馬メモ保存ではPredictionを保存しない");
    },
    saveRaceResult: async () => {
      throw new Error("出走馬メモ保存ではレース結果を保存しない");
    },
    saveRaceReflection: async () => {
      throw new Error("出走馬メモ保存では振り返りを保存しない");
    },
    invalidateAnalysis: async () => {
      throw new Error("出走馬メモ保存では既存分析を無効化しない");
    },
    appendQaEntry: async () => {
      throw new Error("出走馬メモ保存ではQ&Aを追記しない");
    }
  };
};

/** save-horse-memo usecaseで使わないHorseMemoRepositoryメソッドを失敗スタブとして作る。 */
const createUnusedHorseMemoRepositoryMethods = () => {
  return {
    findHorseMemosByRaceId: async () => {
      throw new Error("出走馬メモ保存ではメモ一覧を読まない");
    },
    saveHorseMemo: async () => {
      throw new Error("テストで差し替えていない一括メモ保存が呼ばれました");
    },
    saveHorseMemoMark: async () => {
      throw new Error("テストで差し替えていない手動印保存が呼ばれました");
    },
    saveHorseMemoNote: async () => {
      throw new Error("テストで差し替えていない本文保存が呼ばれました");
    },
    deleteHorseMemo: async () => {
      throw new Error("出走馬メモ保存では直接削除しない");
    }
  };
};

/** route テスト用の最小限の HorseMemo fixture を作る。 */
const createHorseMemo = (
  raceId: string,
  horseId: string,
  mark: HorseMemo["mark"],
  note: string
): HorseMemo => {
  return {
    raceId,
    horseId,
    mark,
    note,
    createdAt: "2026-06-07T12:00:00.000Z",
    updatedAt: "2026-06-07T12:00:00.000Z"
  };
};
