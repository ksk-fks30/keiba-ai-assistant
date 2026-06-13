import { describe, expect, test } from "vitest";
import type { HorseMemo, LessonEntry } from "@keiba-ai-assistant/models";
import { createRaceRoutes } from "@keiba-ai-assistant/web/server/routes/races";
import type {
  SaveHorseMemoMarkInput,
  SaveHorseMemoNoteInput
} from "@keiba-ai-assistant/web/server/usecases/save-horse-memo";

describe("createRaceRoutes", () => {
  test("JSONの手動印をmark保存usecaseへ渡して保存結果を返す", async () => {
    // Arrange
    const raceId = "fixture-race";
    let actualInput: SaveHorseMemoMarkInput | null = null;
    const routes = createRaceRoutes({
      ...createUnusedRaceRouteDependencies(),
      saveHorseMemoMarkUseCase: async (input) => {
        actualInput = input;
        return createHorseMemo(input.raceId, input.horseId, input.mark, "");
      }
    });

    // Act
    const response = await routes.request(`/races/${raceId}/horse-memos/mark`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        horseId: "fixture-horse-001",
        mark: "◯"
      })
    });
    const actual = (await response.json()) as { memo: HorseMemo };

    // Assert
    expect(response.status).toBe(200);
    expect(actualInput).toEqual({
      raceId,
      horseId: "fixture-horse-001",
      mark: "◯"
    });
    expect(actual.memo.mark).toBe("◯");
  });

  test("nullの手動印をmark保存usecaseへ渡せる", async () => {
    // Arrange
    const raceId = "fixture-race";
    let actualInput: SaveHorseMemoMarkInput | null = null;
    const routes = createRaceRoutes({
      ...createUnusedRaceRouteDependencies(),
      saveHorseMemoMarkUseCase: async (input) => {
        actualInput = input;
        return null;
      }
    });

    // Act
    const response = await routes.request(`/races/${raceId}/horse-memos/mark`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ horseId: "fixture-horse-001", mark: null })
    });
    const actual = (await response.json()) as { memo: HorseMemo | null };

    // Assert
    expect(response.status).toBe(200);
    expect(actualInput).toEqual({
      raceId,
      horseId: "fixture-horse-001",
      mark: null
    });
    expect(actual.memo).toBeNull();
  });

  test("JSONのテキストメモをnote保存usecaseへ渡して保存結果を返す", async () => {
    // Arrange
    const raceId = "fixture-race";
    let actualInput: SaveHorseMemoNoteInput | null = null;
    const routes = createRaceRoutes({
      ...createUnusedRaceRouteDependencies(),
      saveHorseMemoNoteUseCase: async (input) => {
        actualInput = input;
        return createHorseMemo(input.raceId, input.horseId, null, input.note);
      }
    });

    // Act
    const response = await routes.request(`/races/${raceId}/horse-memos/note`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        horseId: "fixture-horse-001",
        note: "  返し馬を確認する  "
      })
    });
    const actual = (await response.json()) as { memo: HorseMemo };

    // Assert
    expect(response.status).toBe(200);
    expect(actualInput).toEqual({
      raceId,
      horseId: "fixture-horse-001",
      note: "返し馬を確認する"
    });
    expect(actual.memo.note).toBe("返し馬を確認する");
  });

  test("未定義の印は400を返す", async () => {
    // Arrange
    const routes = createRaceRoutes(createUnusedRaceRouteDependencies());

    // Act
    const response = await routes.request("/races/fixture-race/horse-memos/mark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ horseId: "fixture-horse-001", mark: "注" })
    });

    // Assert
    expect(response.status).toBe(400);
  });

  test("文字列以外のテキストメモは400を返す", async () => {
    // Arrange
    const routes = createRaceRoutes(createUnusedRaceRouteDependencies());

    // Act
    const response = await routes.request("/races/fixture-race/horse-memos/note", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ horseId: "fixture-horse-001", note: null })
    });

    // Assert
    expect(response.status).toBe(400);
  });
});

/** route テスト用の未使用依存を失敗スタブとして作る。 */
const createUnusedRaceRouteDependencies = (): Parameters<typeof createRaceRoutes>[0] => {
  return {
    showRaceUseCase: async () => {
      throw new Error("出走馬メモrouteではrace詳細propsを読まない");
    },
    reflectRaceJobStore: {
      start: () => {
        throw new Error("出走馬メモrouteでは振り返りジョブを開始しない");
      },
      findById: () => {
        throw new Error("出走馬メモrouteでは振り返りジョブを読まない");
      }
    },
    approveLessonUseCase: async (): Promise<LessonEntry> => {
      throw new Error("出走馬メモrouteではLessonを採用しない");
    },
    saveHorseMemoMarkUseCase: async () => {
      throw new Error("テストで差し替えていない手動印保存が呼ばれました");
    },
    saveHorseMemoNoteUseCase: async () => {
      throw new Error("テストで差し替えていない本文保存が呼ばれました");
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
