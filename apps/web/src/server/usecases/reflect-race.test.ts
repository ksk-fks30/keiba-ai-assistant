import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import type { ExtractRaceResultFromSnapshotInput, ReflectRaceInput } from "@keiba-ai-assistant/ai";
import {
  parseRace,
  type LessonEntry,
  type Prediction,
  type PredictionPolicy,
  type RaceReflection,
  type RaceReflectionDraft,
  type RaceResult,
  type SourcePageSnapshot
} from "@keiba-ai-assistant/models";
import type { CollectRaceResultSnapshotInput } from "@keiba-ai-assistant/scraper";
import { createReflectRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/reflect-race";

describe("createReflectRaceUseCase", () => {
  test("結果を取得して振り返りとLesson候補を保存できる", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const prediction = createPrediction(race.id);
    const policy = createPredictionPolicy();
    const snapshot = createSourcePageSnapshot();
    const result = createRaceResult(race.id);
    const draft = createRaceReflectionDraft();
    const savedLessons: LessonEntry[] = [];
    let savedResult: RaceResult | null = null;
    let savedReflection: RaceReflection | null = null;
    let actualCollectInput: CollectRaceResultSnapshotInput | null = null;
    let actualExtractInput: ExtractRaceResultFromSnapshotInput | null = null;
    let actualReflectInput: ReflectRaceInput | null = null;
    const abortController = new AbortController();
    const reflectRaceUseCase = createReflectRaceUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceReflectionByRaceId: async () => null,
        findRaceById: async () => race,
        findPredictionByRaceId: async () => prediction,
        findRaceResultByRaceId: async () => null,
        saveRaceResult: async (input) => {
          savedResult = input;
        },
        saveRaceReflection: async (input) => {
          savedReflection = input;
        }
      },
      policyRepository: {
        readPredictionPolicy: async () => policy
      },
      lessonRepository: {
        ...createUnusedLessonRepositoryMethods(),
        saveLessonEntry: async (lesson) => {
          savedLessons.push(lesson);
        }
      },
      collectRaceResultSnapshot: async (input) => {
        actualCollectInput = input;
        return snapshot;
      },
      extractRaceResultFromSnapshot: async (input) => {
        actualExtractInput = input;
        return result;
      },
      reflectRace: async (input) => {
        actualReflectInput = input;
        return draft;
      },
      now: createFixedNow(),
      createLessonId: ({ index }) => `lesson-${index + 1}`
    });

    // Act
    const actual = await reflectRaceUseCase({
      raceId: race.id,
      minDelayMs: 123,
      resultExtractTimeoutMs: 1_000,
      reflectionTimeoutMs: 2_000,
      signal: abortController.signal
    });

    // Assert
    expect(actual).toEqual({ raceId: race.id });
    expect(actualCollectInput).toEqual({
      resultUrl: `https://race.netkeiba.com/race/result.html?race_id=${race.id}`,
      headless: true,
      minDelayMs: 123,
      signal: abortController.signal
    });
    expect(actualExtractInput).toEqual({
      raceId: race.id,
      snapshot,
      timeoutMs: 1_000,
      signal: abortController.signal
    });
    expect(actualReflectInput).toEqual({
      race,
      prediction,
      result,
      policy,
      timeoutMs: 2_000,
      signal: abortController.signal
    });
    expect(savedResult).toEqual(result);
    expect(savedLessons).toEqual([
      {
        id: "lesson-1",
        sourceRaceId: race.id,
        status: "draft",
        title: "前残りでは先行馬を残す",
        situationKey: "芝1600m・前残り・先行馬",
        tags: ["芝", "前残り", "先行"],
        diaryText: "架空レースでは前残りで先行馬を軽視した。",
        decisionGuidance: "前残り傾向が明確なら先行馬を相手に残す。",
        applicableWhen: ["前が止まりにくい馬場"],
        notApplicableWhen: ["差しが届く馬場"],
        confidence: "medium",
        createdAt: "2026-06-07T16:20:00.000Z",
        updatedAt: "2026-06-07T16:20:00.000Z"
      }
    ]);
    expect(savedReflection).toEqual({
      raceId: race.id,
      reflectedAt: "2026-06-07T16:20:00.000Z",
      summary: draft.summary,
      lessonIds: ["lesson-1"]
    });
  });

  test("保存済み振り返りがある場合は結果を再取得しない", async () => {
    // Arrange
    const raceId = "fixture-aoba-mile-2026";
    const reflection = createRaceReflection(raceId);
    const reflectRaceUseCase = createReflectRaceUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceReflectionByRaceId: async () => reflection,
        findRaceById: async () => {
          throw new Error("振り返り済みではrace.jsonを読まない");
        }
      },
      policyRepository: {
        readPredictionPolicy: async () => {
          throw new Error("振り返り済みでは予想方針を読まない");
        }
      },
      lessonRepository: createUnusedLessonRepositoryMethods(),
      collectRaceResultSnapshot: async () => {
        throw new Error("振り返り済みでは結果ページを開かない");
      },
      extractRaceResultFromSnapshot: async () => {
        throw new Error("振り返り済みでは結果構造化を実行しない");
      },
      reflectRace: async () => {
        throw new Error("振り返り済みではAIを実行しない");
      }
    });

    // Act
    const actual = await reflectRaceUseCase({ raceId });

    // Assert
    expect(actual).toEqual({ raceId });
  });
});

/** usecase テスト用のSourcePageSnapshotを作る。 */
const createSourcePageSnapshot = (): SourcePageSnapshot => {
  return {
    sourceUrl: "https://race.netkeiba.com/race/result.html?race_id=fixture-aoba-mile-2026",
    pageTitle: "架空レース 結果",
    visibleText: "1 フィクスチャホース 架空騎手",
    headings: ["結果"],
    tableTexts: ["着順 馬番 馬名 騎手 人気 オッズ タイム"],
    links: [],
    capturedAt: "2026-06-07T16:05:00.000Z"
  };
};

/** usecase テスト用のPredictionを作る。 */
const createPrediction = (raceId: string): Prediction => {
  return {
    raceId,
    summary: "架空レースでは先行力を重視する。",
    evaluations: [
      {
        horseId: "fixture-horse-001",
        mark: "favorite",
        score: 88,
        reasons: ["先行力がある。"],
        risks: ["差しが届く馬場では危うい。"]
      }
    ],
    betCandidates: [
      {
        type: "単勝",
        horses: ["fixture-horse-001"],
        reason: "能力評価が最上位。",
        stakeWeight: 100
      }
    ],
    referencedLessons: [],
    generatedAt: "2026-06-07T14:00:00.000Z"
  };
};

/** usecase テスト用のPredictionPolicyを作る。 */
const createPredictionPolicy = (): PredictionPolicy => {
  return {
    path: "/tmp/policies/main.md",
    content: "架空レースでは先行力を重視する。",
    loadedAt: "2026-06-07T13:00:00.000Z"
  };
};

/** usecase テスト用のRaceResultを作る。 */
const createRaceResult = (raceId: string): RaceResult => {
  return {
    raceId,
    sourceUrl: `https://race.netkeiba.com/race/result.html?race_id=${raceId}`,
    collectedAt: "2026-06-07T16:05:00.000Z",
    entries: [
      {
        rank: "1",
        horseNumber: 3,
        horseName: "フィクスチャホース",
        jockey: "架空騎手",
        popularity: 2,
        odds: 4.8,
        time: "1:33.8",
        margin: ""
      }
    ]
  };
};

/** usecase テスト用のRaceReflectionDraftを作る。 */
const createRaceReflectionDraft = (): RaceReflectionDraft => {
  return {
    summary: "先行力評価は良かったが、馬場傾向の見積もりが甘かった。",
    lessons: [
      {
        title: " 前残りでは先行馬を残す ",
        situationKey: "芝1600m・前残り・先行馬",
        tags: ["芝", "前残り", "先行", "先行"],
        diaryText: "架空レースでは前残りで先行馬を軽視した。",
        decisionGuidance: "前残り傾向が明確なら先行馬を相手に残す。",
        applicableWhen: ["前が止まりにくい馬場", ""],
        notApplicableWhen: ["差しが届く馬場"],
        confidence: "medium"
      }
    ]
  };
};

/** usecase テスト用のRaceReflectionを作る。 */
const createRaceReflection = (raceId: string): RaceReflection => {
  return {
    raceId,
    reflectedAt: "2026-06-07T16:20:00.000Z",
    summary: "保存済み振り返りです。",
    lessonIds: ["lesson-1"]
  };
};

/** usecase テスト用に固定日時を返す関数を作る。 */
const createFixedNow = () => {
  return () => new Date("2026-06-07T16:20:00.000Z");
};

/** reflect usecaseテストで使わないRunRepositoryメソッドを失敗スタブとして作る。 */
const createUnusedRunRepositoryMethods = () => {
  return {
    findSavedRaceRuns: async () => {
      throw new Error("reflectではrun一覧を読まない");
    },
    findRaceById: async () => {
      throw new Error("テストで差し替えていないRace読込が呼ばれました");
    },
    findPredictionByRaceId: async () => {
      throw new Error("テストで差し替えていないPrediction読込が呼ばれました");
    },
    findQaEntriesByRaceId: async () => {
      throw new Error("reflectではQ&A履歴を読まない");
    },
    findRaceResultByRaceId: async () => {
      throw new Error("テストで差し替えていないRaceResult読込が呼ばれました");
    },
    findRaceReflectionByRaceId: async () => {
      throw new Error("テストで差し替えていないRaceReflection読込が呼ばれました");
    },
    saveRace: async () => {
      throw new Error("reflectではRaceを保存しない");
    },
    savePrediction: async () => {
      throw new Error("reflectではPredictionを保存しない");
    },
    saveRaceResult: async () => {
      throw new Error("テストで差し替えていないRaceResult保存が呼ばれました");
    },
    saveRaceReflection: async () => {
      throw new Error("テストで差し替えていないRaceReflection保存が呼ばれました");
    },
    invalidateAnalysis: async () => {
      throw new Error("reflectでは既存分析を無効化しない");
    },
    appendQaEntry: async () => {
      throw new Error("reflectではQ&Aを追記しない");
    }
  };
};

/** reflect usecaseテストで使わないLessonRepositoryメソッドを失敗スタブとして作る。 */
const createUnusedLessonRepositoryMethods = () => {
  return {
    saveLessonEntry: async () => {
      throw new Error("テストで差し替えていないLesson保存が呼ばれました");
    },
    findLessonEntriesByIds: async () => {
      throw new Error("reflectではLesson一覧を読まない");
    },
    updateLessonStatus: async () => {
      throw new Error("reflectではLesson状態を更新しない");
    }
  };
};
