import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace, type Prediction } from "@keiba-ai-assistant/models";
import { createRunRepository } from "@keiba-ai-assistant/web/server/repositories/run-repository";
import { writePrediction, writeRace } from "@keiba-ai-assistant/storage";

const tempRootDirs: string[] = [];

afterEach(async () => {
  // Arrange
  const rootDirs = tempRootDirs.splice(0);

  // Act
  await Promise.all(rootDirs.map((rootDir) => rm(rootDir, { recursive: true, force: true })));

  // Assert
  expect(tempRootDirs).toHaveLength(0);
});

describe("createRunRepository", () => {
  test("保存済みrace.jsonをRaceモデルとして取得できる", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const race = parseRace(sampleRace);
    const repository = createRunRepository({ runStoreOptions: { rootDir } });
    await writeRace(race, { rootDir });

    // Act
    const actual = await repository.findRaceById(race.id);

    // Assert
    expect(actual).toEqual(race);
  });

  test("race.jsonが存在しない場合はnullを返す", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const repository = createRunRepository({ runStoreOptions: { rootDir } });

    // Act
    const actual = await repository.findRaceById("missing-race");

    // Assert
    expect(actual).toBeNull();
  });

  test("保存済みprediction.jsonをPredictionモデルとして取得できる", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const race = parseRace(sampleRace);
    const prediction = createPrediction(race.id);
    const repository = createRunRepository({ runStoreOptions: { rootDir } });
    await writePrediction(prediction, { rootDir });

    // Act
    const actual = await repository.findPredictionByRaceId(race.id);

    // Assert
    expect(actual).toEqual(prediction);
  });

  test("prediction.jsonが存在しない場合はnullを返す", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const repository = createRunRepository({ runStoreOptions: { rootDir } });

    // Act
    const actual = await repository.findPredictionByRaceId("missing-race");

    // Assert
    expect(actual).toBeNull();
  });
});

/** repository テスト用の最小限の Prediction fixture を作る。 */
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

/** 後片付け対象として記録した一時run保存先を作る。 */
const createTempRootDir = async (): Promise<string> => {
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-web-run-repository-"));
  tempRootDirs.push(rootDir);
  return rootDir;
};
