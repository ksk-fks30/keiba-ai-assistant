import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace } from "@keiba-ai-assistant/models";
import { createRunRepository } from "@keiba-ai-assistant/web/server/repositories/run-repository";
import { writeRace } from "@keiba-ai-assistant/storage";

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
});

/** 後片付け対象として記録した一時run保存先を作る。 */
const createTempRootDir = async (): Promise<string> => {
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-web-run-repository-"));
  tempRootDirs.push(rootDir);
  return rootDir;
};
