import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { afterEach, describe, expect, test } from "vitest";
import { registerPredictCommand } from "@keiba-ai-assistant/cli/commands/predict";
import {
  parseRace,
  type Prediction,
  type Race,
  type RaceSourceSnapshot
} from "@keiba-ai-assistant/models";
import {
  appendQaEntry,
  readPrediction,
  readQaEntries,
  readRace,
  writePrediction
} from "@keiba-ai-assistant/storage";

const tempRootDirs: string[] = [];

afterEach(async () => {
  // Arrange
  const rootDirs = tempRootDirs.splice(0);

  // Act
  await Promise.all(rootDirs.map((rootDir) => rm(rootDir, { recursive: true, force: true })));

  // Assert
  expect(tempRootDirs).toHaveLength(0);
});

describe("registerPredictCommand", () => {
  test("netKeiba取得からAI分析まで連続実行できる", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const policyPath = await writeTempPolicyFile("芝マイルでは持続力を重視する。");
    const snapshot = createSnapshot();
    const race = createRace(snapshot);
    const prediction = createPrediction(race.id);
    const logs: string[] = [];
    const program = createPredictProgram({
      collectRaceSnapshot: async (input) => {
        expect(input).toEqual({
          raceUrl: snapshot.racePage.sourceUrl,
          minDelayMs: 5000,
          horseDetailLimit: 1,
          headless: true,
          onProgress: expect.any(Function)
        });
        input.onProgress?.("netKeiba snapshot取得中です。");
        return snapshot;
      },
      extractRaceFromSnapshot: async (input) => {
        expect(input.snapshot).toEqual(snapshot);
        expect(input.model).toBe("fixture-codex-model");
        return race;
      },
      weatherProvider: {
        getWeather: async () => ({
          condition: "晴れ",
          precipitationProbability: 20,
          temperatureCelsius: 24.8,
          wind: "南西 12km/h",
          source: "https://api.open-meteo.com/v1/forecast",
          observedAt: "2026-05-31T16:00:00+09:00"
        })
      },
      analyzeRace: async (input) => {
        expect(input.race).toEqual({
          ...race,
          weather: {
            condition: "晴れ",
            precipitationProbability: 20,
            temperatureCelsius: 24.8,
            wind: "南西 12km/h",
            source: "https://api.open-meteo.com/v1/forecast",
            observedAt: "2026-05-31T16:00:00+09:00"
          }
        });
        expect(input.policy.content).toBe("芝マイルでは持続力を重視する。");
        expect(input.model).toBe("fixture-codex-model");
        return prediction;
      },
      log: (message) => {
        logs.push(message);
      }
    });

    // Act
    await program.parseAsync([
      "node",
      "test",
      "predict",
      snapshot.racePage.sourceUrl,
      "--runs-dir",
      rootDir,
      "--policy-path",
      policyPath,
      "--model",
      "fixture-codex-model",
      "--min-delay-ms",
      "5000",
      "--horse-detail-limit",
      "1"
    ]);
    const actualRace = await readRace(race.id, { rootDir });
    const actualPrediction = await readPrediction(race.id, { rootDir });

    // Assert
    expect(actualRace).toEqual({
      ...race,
      weather: {
        condition: "晴れ",
        precipitationProbability: 20,
        temperatureCelsius: 24.8,
        wind: "南西 12km/h",
        source: "https://api.open-meteo.com/v1/forecast",
        observedAt: "2026-05-31T16:00:00+09:00"
      }
    });
    expect(actualPrediction).toEqual(prediction);
    expect(logs).toEqual([
      "レース取得と分析を開始します。",
      "netKeiba snapshot取得中です。",
      "AIでレース情報を構造化しています。",
      `レース情報を構造化しました: ${race.name} (${race.id})`,
      "Open-Meteoから天気情報を取得しています。",
      "天気情報を取得しました: 晴れ / 24.8℃ / 降水20% / 南西 12km/h",
      "既存の予想結果を無効化しています。",
      `既存の予想結果を無効化しました: ${race.id}`,
      "race.json を保存しています。",
      `race.json を保存しました: ${race.id}`,
      "予想方針を読み込んでいます。",
      "Codexで予想分析を実行しています。",
      "prediction.json を保存しています。",
      `prediction.json を保存しました: ${prediction.raceId}`,
      `レース取得と分析が完了しました: ${prediction.raceId}`
    ]);
  });

  test("分析に失敗した場合は既存予想とQ&Aを無効化してrace.jsonだけ保存できる", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const policyPath = await writeTempPolicyFile("芝マイルでは持続力を重視する。");
    const snapshot = createSnapshot();
    const race = createRace(snapshot);
    await writePrediction(createPrediction(race.id), { rootDir });
    await appendQaEntry(
      {
        id: "qa-fixture-old",
        raceId: race.id,
        question: "古い質問は？",
        answer: "古い回答。",
        createdAt: "2026-05-31T14:45:00+09:00"
      },
      { rootDir }
    );
    const program = createPredictProgram({
      collectRaceSnapshot: async () => snapshot,
      extractRaceFromSnapshot: async () => race,
      weatherProvider: {
        getWeather: async () => ({})
      },
      analyzeRace: async () => {
        throw new Error("analysis failed");
      },
      log: () => {}
    });

    // Act
    const actual = program.parseAsync([
      "node",
      "test",
      "predict",
      snapshot.racePage.sourceUrl,
      "--runs-dir",
      rootDir,
      "--policy-path",
      policyPath
    ]);

    // Assert
    await expect(actual).rejects.toThrow("analysis failed");
    await expect(readRace(race.id, { rootDir })).resolves.toEqual({ ...race, weather: {} });
    await expect(readPrediction(race.id, { rootDir })).rejects.toThrow();
    await expect(readQaEntries(race.id, { rootDir })).resolves.toEqual([]);
  });
});

/** predict コマンドだけを登録したテスト用 Commander program を作る。 */
const createPredictProgram = (
  dependencies: Parameters<typeof registerPredictCommand>[1]
): Command => {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeErr: () => {},
    writeOut: () => {}
  });
  registerPredictCommand(program, dependencies);
  return program;
};

/** predict コマンドテスト用のページsnapshotを作る。 */
const createSnapshot = (): RaceSourceSnapshot => {
  const racePage = {
    sourceUrl: "https://example.test/race?race_id=fixture-aoba-mile-2026",
    pageTitle: "青葉架空マイル",
    visibleText: "青葉架空マイル\n東京 芝1600m\n1 シラユキコード 架空 太郎",
    headings: ["青葉架空マイル"],
    tableTexts: ["馬番 馬名 騎手\n1 シラユキコード 架空 太郎"],
    links: [],
    capturedAt: "2026-05-31T10:30:00.000Z"
  };

  return {
    racePage,
    horseDetailPages: [
      {
        ...racePage,
        sourceUrl: "https://example.test/horse/fixture-horse-001",
        pageTitle: "シラユキコード"
      }
    ],
    pedigreePages: []
  };
};

/** predict コマンドテスト用のRaceを作る。 */
const createRace = (snapshot: RaceSourceSnapshot): Race => {
  return parseRace({
    id: "fixture-aoba-mile-2026",
    sourceUrl: snapshot.racePage.sourceUrl,
    name: "青葉架空マイル",
    racecourse: "東京",
    startTime: "2026-05-31T15:40:00+09:00",
    surface: "turf",
    distanceMeters: 1600,
    horses: [
      {
        id: "fixture-horse-001",
        name: "シラユキコード",
        horseNumber: 1,
        jockey: "架空 太郎"
      }
    ],
    collectedAt: snapshot.racePage.capturedAt
  });
};

/** CLI 保存確認で使う最小限の Prediction fixture を作る。 */
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
        reason: "軸として最も安定している。",
        stakeWeight: 40
      }
    ],
    referencedLessons: [],
    generatedAt: "2026-05-31T14:40:00+09:00"
  };
};

/** テストごとに分離された一時予想方針ファイルを書き出す。 */
const writeTempPolicyFile = async (content: string): Promise<string> => {
  const rootDir = await createTempRootDir();
  const policyPath = join(rootDir, "main.md");
  await writeFile(policyPath, content, "utf8");
  return policyPath;
};

/** 後片付け対象として記録した一時ディレクトリを作る。 */
const createTempRootDir = async (): Promise<string> => {
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-predict-command-"));
  tempRootDirs.push(rootDir);
  return rootDir;
};
