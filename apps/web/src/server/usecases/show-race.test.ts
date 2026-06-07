import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import {
  parseRace,
  type LessonEntry,
  type Prediction,
  type QaEntry,
  type RaceReflection,
  type RaceResult
} from "@keiba-ai-assistant/models";
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
        findRaceResultByRaceId: async (raceId) => {
          expect(raceId).toBe(race.id);
          return null;
        },
        findRaceReflectionByRaceId: async (raceId) => {
          expect(raceId).toBe(race.id);
          return null;
        },
        appendQaEntry: async () => {
          throw new Error("詳細表示ではQ&Aを追記しない");
        }
      },
      lessonRepository: createUnusedLessonRepositoryMethods(),
      now: createBeforeRaceNow()
    });

    // Act
    const actual = await showRaceUseCase({ raceId: race.id });

    // Assert
    expect(actual).toEqual({
      raceId: race.id,
      race,
      prediction,
      qaEntries,
      raceResult: null,
      raceReflection: null,
      reflectionLessons: [],
      canStartReflection: false,
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
        findRaceResultByRaceId: async () => null,
        findRaceReflectionByRaceId: async () => null,
        appendQaEntry: async () => {
          throw new Error("詳細表示ではQ&Aを追記しない");
        }
      },
      lessonRepository: createUnusedLessonRepositoryMethods(),
      now: createBeforeRaceNow()
    });

    // Act
    const actual = await showRaceUseCase({ raceId: race.id, askError });

    // Assert
    expect(actual).toEqual({
      raceId: race.id,
      race,
      prediction: null,
      qaEntries: [],
      raceResult: null,
      raceReflection: null,
      reflectionLessons: [],
      canStartReflection: false,
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
        findRaceResultByRaceId: async () => {
          throw new Error("Raceがない場合はレース結果を読まない");
        },
        findRaceReflectionByRaceId: async () => {
          throw new Error("Raceがない場合は振り返りを読まない");
        },
        appendQaEntry: async () => {
          throw new Error("詳細表示ではQ&Aを追記しない");
        }
      },
      lessonRepository: createUnusedLessonRepositoryMethods(),
      now: createBeforeRaceNow()
    });

    // Act
    const actual = await showRaceUseCase({ raceId });

    // Assert
    expect(actual).toEqual({
      raceId,
      race: null,
      prediction: null,
      qaEntries: [],
      raceResult: null,
      raceReflection: null,
      reflectionLessons: [],
      canStartReflection: false,
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
        findRaceResultByRaceId: async () => null,
        findRaceReflectionByRaceId: async () => null,
        appendQaEntry: async () => {
          throw new Error("詳細表示ではQ&Aを追記しない");
        }
      },
      lessonRepository: createUnusedLessonRepositoryMethods(),
      now: createBeforeRaceNow()
    });

    // Act
    const actual = await showRaceUseCase({ raceId: race.id });

    // Assert
    expect(actual).toEqual({
      raceId: race.id,
      race,
      prediction: null,
      qaEntries: [],
      raceResult: null,
      raceReflection: null,
      reflectionLessons: [],
      canStartReflection: false,
      askError: null
    });
  });

  test("発走後でPredictionがあり未振り返りの場合は振り返り開始可能にする", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const prediction = createPrediction(race.id);
    const showRaceUseCase = createShowRaceUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async () => race,
        findPredictionByRaceId: async () => prediction,
        findQaEntriesByRaceId: async () => [],
        findRaceResultByRaceId: async () => null,
        findRaceReflectionByRaceId: async () => null
      },
      lessonRepository: createUnusedLessonRepositoryMethods(),
      now: () => new Date("2026-06-07T16:00:00+09:00")
    });

    // Act
    const actual = await showRaceUseCase({ raceId: race.id });

    // Assert
    expect(actual.canStartReflection).toBe(true);
  });

  test("保存済み振り返りがある場合は結果とLessonをpropsに含める", async () => {
    // Arrange
    const race = parseRace(sampleRace);
    const prediction = createPrediction(race.id);
    const raceResult = createRaceResult(race.id);
    const raceReflection = createRaceReflection(race.id);
    const lessons = [createLessonEntry(race.id, "lesson-fixture-001")];
    const showRaceUseCase = createShowRaceUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        findRaceById: async () => race,
        findPredictionByRaceId: async () => prediction,
        findQaEntriesByRaceId: async () => [],
        findRaceResultByRaceId: async () => raceResult,
        findRaceReflectionByRaceId: async () => raceReflection
      },
      lessonRepository: {
        ...createUnusedLessonRepositoryMethods(),
        findLessonEntriesByIds: async (lessonIds) => {
          expect(lessonIds).toEqual(raceReflection.lessonIds);
          return lessons;
        }
      },
      now: () => new Date("2026-06-07T16:00:00+09:00")
    });

    // Act
    const actual = await showRaceUseCase({ raceId: race.id });

    // Assert
    expect(actual).toMatchObject({
      raceResult,
      raceReflection,
      reflectionLessons: lessons,
      canStartReflection: false
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

/** usecase テスト用の最小限の RaceResult fixture を作る。 */
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

/** usecase テスト用の最小限の RaceReflection fixture を作る。 */
const createRaceReflection = (raceId: string): RaceReflection => {
  return {
    raceId,
    reflectedAt: "2026-06-07T16:20:00.000Z",
    summary: "先行力評価は良かったが、馬場傾向の見積もりが甘かった。",
    lessonIds: ["lesson-fixture-001"]
  };
};

/** usecase テスト用の最小限の LessonEntry fixture を作る。 */
const createLessonEntry = (raceId: string, id: string): LessonEntry => {
  return {
    id,
    sourceRaceId: raceId,
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
  };
};

/** sample race発走前の固定日時を返す。 */
const createBeforeRaceNow = () => {
  return () => new Date("2026-06-06T12:00:00+09:00");
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
    findRaceResultByRaceId: async () => {
      throw new Error("詳細表示ではレース結果を読まない");
    },
    findRaceReflectionByRaceId: async () => {
      throw new Error("詳細表示では振り返りを読まない");
    },
    saveRaceResult: async () => {
      throw new Error("詳細表示ではレース結果を保存しない");
    },
    saveRaceReflection: async () => {
      throw new Error("詳細表示では振り返りを保存しない");
    },
    invalidateAnalysis: async () => {
      throw new Error("詳細表示では既存分析を無効化しない");
    },
    appendQaEntry: async () => {
      throw new Error("詳細表示ではQ&Aを追記しない");
    }
  };
};

/** 詳細表示usecaseで使わないLessonRepositoryメソッドを失敗スタブとして作る。 */
const createUnusedLessonRepositoryMethods = () => {
  return {
    saveLessonEntry: async () => {
      throw new Error("詳細表示ではLessonを保存しない");
    },
    findLessonEntriesByIds: async () => {
      throw new Error("保存済み振り返りがない場合はLessonを読まない");
    },
    searchLessonEntries: async () => {
      throw new Error("詳細表示ではLesson候補を検索しない");
    },
    recordPredictionLessonReferences: async () => {
      throw new Error("詳細表示ではLesson参照履歴を保存しない");
    },
    updateLessonStatus: async () => {
      throw new Error("詳細表示ではLesson状態を更新しない");
    }
  };
};
