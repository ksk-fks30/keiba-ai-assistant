import { describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import type { AnalyzeRaceInput, ExtractRaceFromSnapshotInput } from "@keiba-ai-assistant/ai";
import {
  parseRace,
  type Prediction,
  type PredictionPolicy,
  type Race,
  type RaceSourceSnapshot,
  type Weather
} from "@keiba-ai-assistant/models";
import type { CollectRaceSnapshotInput, WeatherProvider } from "@keiba-ai-assistant/scraper";
import { createPredictRaceUseCase } from "@keiba-ai-assistant/web/server/usecases/predict-race";

describe("createPredictRaceUseCase", () => {
  test("netKeiba URLからレース取得と分析を実行して保存できる", async () => {
    // Arrange
    const raceUrl = "https://race.netkeiba.com/race/shutuba.html?race_id=202605030211";
    const snapshot = createRaceSourceSnapshot();
    const race = createRaceWithoutWeather();
    const weather = createWeather();
    const raceWithWeather = parseRace({ ...race, weather });
    const policy = createPredictionPolicy();
    const prediction = createPrediction(race.id);
    const events: string[] = [];
    let actualCollectInput: CollectRaceSnapshotInput | null = null;
    let actualExtractInput: ExtractRaceFromSnapshotInput | null = null;
    let actualAnalyzeInput: AnalyzeRaceInput | null = null;
    let savedRace: Race | null = null;
    let savedPrediction: Prediction | null = null;
    const abortController = new AbortController();
    const predictRaceUseCase = createPredictRaceUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        invalidateAnalysis: async (raceId) => {
          events.push(`invalidate:${raceId}`);
        },
        saveRace: async (input) => {
          events.push("saveRace");
          savedRace = input;
        },
        savePrediction: async (input) => {
          events.push("savePrediction");
          savedPrediction = input;
        }
      },
      policyRepository: {
        readPredictionPolicy: async () => {
          events.push("policy");
          return policy;
        }
      },
      collectRaceSnapshot: async (input) => {
        events.push("collect");
        actualCollectInput = input;
        return snapshot;
      },
      extractRaceFromSnapshot: async (input) => {
        events.push("extract");
        actualExtractInput = input;
        return race;
      },
      weatherProvider: createWeatherProvider({
        weather,
        onCall: () => {
          events.push("weather");
        }
      }),
      analyzeRace: async (input) => {
        events.push("analyze");
        actualAnalyzeInput = input;
        return prediction;
      }
    });

    // Act
    const actual = await predictRaceUseCase({
      raceUrl: ` ${raceUrl} `,
      extractTimeoutMs: 1_000,
      analysisTimeoutMs: 2_000,
      signal: abortController.signal
    });

    // Assert
    expect(actual).toEqual({ raceId: race.id });
    expect(actualCollectInput).toEqual({
      raceUrl,
      headless: true,
      signal: abortController.signal
    });
    expect(actualExtractInput).toEqual({
      snapshot,
      timeoutMs: 1_000,
      signal: abortController.signal
    });
    expect(actualAnalyzeInput).toEqual({
      race: raceWithWeather,
      policy,
      timeoutMs: 2_000,
      signal: abortController.signal
    });
    expect(savedRace).toEqual(raceWithWeather);
    expect(savedPrediction).toEqual(prediction);
    expect(events).toEqual([
      "collect",
      "extract",
      "weather",
      `invalidate:${race.id}`,
      "saveRace",
      "policy",
      "analyze",
      "savePrediction"
    ]);
  });

  test("Codex実行のtimeout未指定時はWeb用の既定値を渡す", async () => {
    // Arrange
    const race = createRaceWithoutWeather();
    let actualExtractInput: ExtractRaceFromSnapshotInput | null = null;
    let actualAnalyzeInput: AnalyzeRaceInput | null = null;
    const predictRaceUseCase = createPredictRaceUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        invalidateAnalysis: async () => {},
        saveRace: async () => {},
        savePrediction: async () => {}
      },
      policyRepository: {
        readPredictionPolicy: async () => createPredictionPolicy()
      },
      collectRaceSnapshot: async () => createRaceSourceSnapshot(),
      extractRaceFromSnapshot: async (input) => {
        actualExtractInput = input;
        return race;
      },
      weatherProvider: createWeatherProvider({ weather: createWeather() }),
      analyzeRace: async (input) => {
        actualAnalyzeInput = input;
        return createPrediction(race.id);
      }
    });

    // Act
    await predictRaceUseCase({
      raceUrl: "https://race.netkeiba.com/race/shutuba.html?race_id=202605030211"
    });

    // Assert
    expect(actualExtractInput).toMatchObject({ timeoutMs: 1_800_000 });
    expect(actualAnalyzeInput).toMatchObject({ timeoutMs: 1_800_000 });
  });

  test("天気取得に失敗してもRace保存と分析を継続する", async () => {
    // Arrange
    const race = createRaceWithoutWeather();
    let savedRace: Race | null = null;
    const predictRaceUseCase = createPredictRaceUseCase({
      runRepository: {
        ...createUnusedRunRepositoryMethods(),
        invalidateAnalysis: async () => {},
        saveRace: async (input) => {
          savedRace = input;
        },
        savePrediction: async () => {}
      },
      policyRepository: {
        readPredictionPolicy: async () => createPredictionPolicy()
      },
      collectRaceSnapshot: async () => createRaceSourceSnapshot(),
      extractRaceFromSnapshot: async () => race,
      weatherProvider: {
        getWeather: async () => {
          throw new Error("Open-Meteoが一時的に利用できません。");
        }
      },
      analyzeRace: async () => createPrediction(race.id)
    });

    // Act
    const actual = await predictRaceUseCase({
      raceUrl: "https://race.netkeiba.com/race/shutuba.html?race_id=202605030211"
    });

    // Assert
    expect(actual).toEqual({ raceId: race.id });
    expect(savedRace).toEqual(race);
  });

  test("netKeiba以外のURLでは取得を実行しない", async () => {
    // Arrange
    const predictRaceUseCase = createPredictRaceUseCase({
      runRepository: createUnusedRunRepositoryMethods(),
      policyRepository: {
        readPredictionPolicy: async () => {
          throw new Error("URL不正時は予想方針を読まない");
        }
      },
      collectRaceSnapshot: async () => {
        throw new Error("URL不正時はnetKeibaを開かない");
      },
      extractRaceFromSnapshot: async () => {
        throw new Error("URL不正時はRace構造化を実行しない");
      },
      weatherProvider: createWeatherProvider({ weather: createWeather() }),
      analyzeRace: async () => {
        throw new Error("URL不正時は分析を実行しない");
      }
    });

    // Act
    const actual = predictRaceUseCase({ raceUrl: "https://example.com/race?race_id=1" });

    // Assert
    await expect(actual).rejects.toThrow("netKeiba のレースURLを入力してください。");
  });

  test("netKeibaに似た別ホスト名では取得を実行しない", async () => {
    // Arrange
    const predictRaceUseCase = createPredictRaceUseCase({
      runRepository: createUnusedRunRepositoryMethods(),
      policyRepository: {
        readPredictionPolicy: async () => {
          throw new Error("ホスト名不正時は予想方針を読まない");
        }
      },
      collectRaceSnapshot: async () => {
        throw new Error("ホスト名不正時はnetKeibaを開かない");
      },
      extractRaceFromSnapshot: async () => {
        throw new Error("ホスト名不正時はRace構造化を実行しない");
      },
      weatherProvider: createWeatherProvider({ weather: createWeather() }),
      analyzeRace: async () => {
        throw new Error("ホスト名不正時は分析を実行しない");
      }
    });

    // Act
    const actual = predictRaceUseCase({ raceUrl: "https://evilnetkeiba.com/race?race_id=1" });

    // Assert
    await expect(actual).rejects.toThrow("netKeiba のレースURLを入力してください。");
  });

  test("race_idがないURLでは取得を実行しない", async () => {
    // Arrange
    const predictRaceUseCase = createPredictRaceUseCase({
      runRepository: createUnusedRunRepositoryMethods(),
      policyRepository: {
        readPredictionPolicy: async () => {
          throw new Error("race_id不正時は予想方針を読まない");
        }
      },
      collectRaceSnapshot: async () => {
        throw new Error("race_id不正時はnetKeibaを開かない");
      },
      extractRaceFromSnapshot: async () => {
        throw new Error("race_id不正時はRace構造化を実行しない");
      },
      weatherProvider: createWeatherProvider({ weather: createWeather() }),
      analyzeRace: async () => {
        throw new Error("race_id不正時は分析を実行しない");
      }
    });

    // Act
    const actual = predictRaceUseCase({ raceUrl: "https://race.netkeiba.com/race/shutuba.html" });

    // Assert
    await expect(actual).rejects.toThrow("race_id を含む netKeiba のレースURLを入力してください。");
  });
});

/** predict usecaseテスト用のRaceSourceSnapshotを作る。 */
const createRaceSourceSnapshot = (): RaceSourceSnapshot => {
  return {} as RaceSourceSnapshot;
};

/** predict usecaseテスト用に天気未付与のRaceを作る。 */
const createRaceWithoutWeather = (): Race => {
  return parseRace({ ...sampleRace, weather: undefined });
};

/** predict usecaseテスト用のWeatherを作る。 */
const createWeather = (): Weather => {
  return {
    condition: "曇り",
    precipitationProbability: 20,
    temperatureCelsius: 22,
    wind: "南 3m",
    source: "fixture",
    observedAt: "2026-06-07T12:00:00+09:00"
  };
};

/** predict usecaseテスト用のWeatherProviderを作る。 */
const createWeatherProvider = (input: {
  weather: Weather;
  onCall?: (() => void) | undefined;
}): WeatherProvider => {
  return {
    getWeather: async () => {
      input.onCall?.();
      return input.weather;
    }
  };
};

/** predict usecaseテスト用のPredictionを作る。 */
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

/** predict usecaseテスト用のPredictionPolicyを作る。 */
const createPredictionPolicy = (): PredictionPolicy => {
  return {
    path: "/tmp/policies/main.md",
    content: "架空レースでは先行力を重視する。",
    loadedAt: "2026-05-31T05:00:00.000Z"
  };
};

/** predict usecaseテストで使わないRunRepositoryメソッドを失敗スタブとして作る。 */
const createUnusedRunRepositoryMethods = () => {
  return {
    findSavedRaceRuns: async () => {
      throw new Error("predictではrun一覧を読まない");
    },
    findRaceById: async () => {
      throw new Error("predictでは保存済みRaceを読まない");
    },
    findPredictionByRaceId: async () => {
      throw new Error("predictでは保存済みPredictionを読まない");
    },
    findQaEntriesByRaceId: async () => {
      throw new Error("predictではQ&A履歴を読まない");
    },
    findRaceResultByRaceId: async () => {
      throw new Error("predictではレース結果を読まない");
    },
    findRaceReflectionByRaceId: async () => {
      throw new Error("predictでは振り返りを読まない");
    },
    saveRace: async () => {
      throw new Error("テストで差し替えていないRace保存が呼ばれました");
    },
    savePrediction: async () => {
      throw new Error("テストで差し替えていないPrediction保存が呼ばれました");
    },
    saveRaceResult: async () => {
      throw new Error("predictではレース結果を保存しない");
    },
    saveRaceReflection: async () => {
      throw new Error("predictでは振り返りを保存しない");
    },
    invalidateAnalysis: async () => {
      throw new Error("テストで差し替えていない分析無効化が呼ばれました");
    },
    appendQaEntry: async () => {
      throw new Error("predictではQ&Aを追記しない");
    }
  };
};
