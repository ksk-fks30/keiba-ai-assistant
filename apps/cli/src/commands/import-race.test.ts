import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { afterEach, describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace } from "@keiba-ai-assistant/models";
import { registerImportRaceCommand } from "@keiba-ai-assistant/cli/commands/import-race";
import { listRuns, readRace } from "@keiba-ai-assistant/storage";

const tempRootDirs: string[] = [];

afterEach(async () => {
  // Arrange
  const rootDirs = tempRootDirs.splice(0);

  // Act
  await Promise.all(rootDirs.map((rootDir) => rm(rootDir, { recursive: true, force: true })));

  // Assert
  expect(tempRootDirs).toHaveLength(0);
});

describe("registerImportRaceCommand", () => {
  test("構造化済み race JSON を run に保存できる", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const raceJsonPath = await writeTempJsonFile(JSON.stringify(sampleRace));
    const race = parseRace(sampleRace);
    const logs: string[] = [];
    const program = createImportRaceProgram({
      log: (message) => {
        logs.push(message);
      }
    });

    // Act
    await program.parseAsync(["node", "test", "import-race", raceJsonPath, "--runs-dir", rootDir]);
    const actual = await readRace(race.id, { rootDir });

    // Assert
    expect(actual).toEqual(race);
    expect(logs).toEqual([
      `race JSON を読み込んでいます: ${raceJsonPath}`,
      "race.json を保存しています。",
      `race.json を保存しました: ${race.id}`
    ]);
  });

  test("Race として不正な JSON は保存しない", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const raceJsonPath = await writeTempJsonFile(JSON.stringify({ id: "invalid-race" }));
    const program = createImportRaceProgram({ log: () => {} });

    // Act
    const actual = program.parseAsync([
      "node",
      "test",
      "import-race",
      "--race-json",
      raceJsonPath,
      "--runs-dir",
      rootDir
    ]);

    // Assert
    await expect(actual).rejects.toThrow();
    await expect(listRuns({ rootDir })).resolves.toEqual([]);
  });
});

/** import-race コマンドだけを登録したテスト用 Commander program を作る。 */
const createImportRaceProgram = (
  dependencies: Parameters<typeof registerImportRaceCommand>[1]
): Command => {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeErr: () => {},
    writeOut: () => {}
  });
  registerImportRaceCommand(program, dependencies);
  return program;
};

/** テストごとに分離された一時 JSON ファイルを書き出す。 */
const writeTempJsonFile = async (content: string): Promise<string> => {
  const rootDir = await createTempRootDir();
  const jsonPath = join(rootDir, "race.json");
  await writeFile(jsonPath, content, "utf8");
  return jsonPath;
};

/** 後片付け対象として記録した一時ディレクトリを作る。 */
const createTempRootDir = async (): Promise<string> => {
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-import-race-command-"));
  tempRootDirs.push(rootDir);
  return rootDir;
};
