import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import {
  parseRace,
  type Prediction,
  type QaEntry,
  type RaceReflection,
  type RaceResult
} from "@keiba-ai-assistant/models";
import {
  appendQaEntry,
  createRun,
  getRunDir,
  invalidateRunAnalysis,
  listRuns,
  readQaEntries,
  readPrediction,
  readRace,
  readRaceReflection,
  readRaceResult,
  runExists,
  writePrediction,
  writeRace,
  writeRaceReflection,
  writeRaceResult,
  type RunStoreOptions
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

describe("run-store", () => {
  test("ネストしたcwdからでもデフォルトのrun保存先はリポジトリルートのrunsになる", () => {
    // Arrange
    const workspaceRoot = process.cwd();
    const nestedCwd = join(workspaceRoot, "apps", "cli");
    const raceId = "fixture-aoba-mile-2026";
    let actual = "";

    process.chdir(nestedCwd);
    try {
      // Act
      actual = getRunDir(raceId);
    } finally {
      process.chdir(workspaceRoot);
    }

    // Assert
    expect(actual).toBe(join(workspaceRoot, "runs", raceId));
  });

  test("架空レース fixture を run として保存して読み込める", async () => {
    // Arrange
    const options = await createTempRunStoreOptions();
    const race = parseRace(sampleRace);

    // Act
    await writeRace(race, options);
    const actual = await readRace(race.id, options);
    const exists = await runExists(race.id, options);
    const summaries = await listRuns(options);

    // Assert
    expect(actual).toEqual(race);
    expect(exists).toBe(true);
    expect(summaries).toMatchObject([
      {
        raceId: race.id,
        hasRace: true,
        hasPrediction: false,
        hasQa: false,
        hasResult: false,
        hasReflection: false
      }
    ]);
  });

  test("予想結果を保存してモデルとして読み込める", async () => {
    // Arrange
    const options = await createTempRunStoreOptions();
    const prediction: Prediction = {
      raceId: "fixture-aoba-mile-2026",
      summary: "先行馬と差し馬の比較を重視する。",
      evaluations: [
        {
          horseId: "fixture-horse-001",
          mark: "favorite",
          score: 86,
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
      generatedAt: "2026-05-31T13:30:00+09:00"
    };

    // Act
    await writePrediction(prediction, options);
    const actual = await readPrediction(prediction.raceId, options);
    const summaries = await listRuns(options);

    // Assert
    expect(actual).toEqual(prediction);
    expect(summaries[0]?.hasPrediction).toBe(true);
  });

  test("既存の予想結果、Q&A履歴、結果振り返りを無効化できる", async () => {
    // Arrange
    const options = await createTempRunStoreOptions();
    const race = parseRace(sampleRace);
    const prediction: Prediction = {
      raceId: race.id,
      summary: "古い予想結果。",
      evaluations: [
        {
          horseId: "fixture-horse-001",
          mark: "favorite",
          score: 86,
          reasons: ["古い評価理由。"],
          risks: ["古いリスク。"]
        }
      ],
      betCandidates: [
        {
          type: "単勝",
          horses: ["fixture-horse-001"],
          reason: "古い買い目理由。",
          stakeWeight: 40
        }
      ],
      referencedLessons: [],
      generatedAt: "2026-05-31T13:30:00+09:00"
    };
    const qaEntry: QaEntry = {
      id: "qa-fixture-001",
      raceId: race.id,
      question: "古い質問は？",
      answer: "古い回答。",
      createdAt: "2026-05-31T13:35:00+09:00"
    };
    await writeRace(race, options);
    await writePrediction(prediction, options);
    await appendQaEntry(qaEntry, options);
    await writeRaceResult(createRaceResult(race.id), options);
    await writeRaceReflection(createRaceReflection(race.id), options);

    // Act
    await invalidateRunAnalysis(race.id, options);
    const actualRace = await readRace(race.id, options);
    const qaEntries = await readQaEntries(race.id, options);
    const summaries = await listRuns(options);

    // Assert
    expect(actualRace).toEqual(race);
    await expect(readPrediction(race.id, options)).rejects.toThrow();
    await expect(readRaceResult(race.id, options)).rejects.toThrow();
    await expect(readRaceReflection(race.id, options)).rejects.toThrow();
    expect(qaEntries).toEqual([]);
    expect(summaries).toMatchObject([
      {
        raceId: race.id,
        hasRace: true,
        hasPrediction: false,
        hasQa: false,
        hasResult: false,
        hasReflection: false
      }
    ]);
  });

  test("レース結果と振り返りを保存してモデルとして読み込める", async () => {
    // Arrange
    const options = await createTempRunStoreOptions();
    const raceId = "fixture-aoba-mile-2026";
    const result = createRaceResult(raceId);
    const reflection = createRaceReflection(raceId);

    // Act
    await writeRaceResult(result, options);
    await writeRaceReflection(reflection, options);
    const actualResult = await readRaceResult(raceId, options);
    const actualReflection = await readRaceReflection(raceId, options);
    const summaries = await listRuns(options);

    // Assert
    expect(actualResult).toEqual(result);
    expect(actualReflection).toEqual(reflection);
    expect(summaries[0]).toMatchObject({
      hasResult: true,
      hasReflection: true
    });
  });

  test("Q&A履歴を追記してモデルとして読み込める", async () => {
    // Arrange
    const options = await createTempRunStoreOptions();
    const firstEntry: QaEntry = {
      id: "qa-fixture-001",
      raceId: "fixture-aoba-mile-2026",
      question: "展開面のリスクは？",
      answer: "逃げ馬が残る展開になると差し馬の評価を下げる必要がある。",
      createdAt: "2026-05-31T13:35:00+09:00"
    };
    const secondEntry: QaEntry = {
      id: "qa-fixture-002",
      raceId: "fixture-aoba-mile-2026",
      question: "馬場が悪化した場合は？",
      answer: "持久力寄りの馬を上げ、瞬発力型の評価を少し下げる。",
      createdAt: "2026-05-31T13:40:00+09:00"
    };

    // Act
    await createRun(firstEntry.raceId, options);
    await appendQaEntry(firstEntry, options);
    await appendQaEntry(secondEntry, options);
    const actual = await readQaEntries(firstEntry.raceId, options);
    const summaries = await listRuns(options);

    // Assert
    expect(actual).toEqual([firstEntry, secondEntry]);
    expect(summaries[0]?.hasQa).toBe(true);
  });

  test("存在しない run は存在確認と一覧で空として扱える", async () => {
    // Arrange
    const options = await createTempRunStoreOptions();

    // Act
    const exists = await runExists("missing-race", options);
    const qaEntries = await readQaEntries("missing-race", options);
    const summaries = await listRuns(options);

    // Assert
    expect(exists).toBe(false);
    expect(qaEntries).toEqual([]);
    expect(summaries).toEqual([]);
  });
});

const createTempRunStoreOptions = async (): Promise<RunStoreOptions> => {
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-run-store-"));
  tempRootDirs.push(rootDir);
  return { rootDir };
};

/** run-storeテスト用のRaceResultを作る。 */
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

/** run-storeテスト用のRaceReflectionを作る。 */
const createRaceReflection = (raceId: string): RaceReflection => {
  return {
    raceId,
    reflectedAt: "2026-06-07T16:20:00.000Z",
    summary: "先行力評価は良かったが、馬場傾向の見積もりが甘かった。",
    lessonIds: ["lesson-fixture-001"]
  };
};
