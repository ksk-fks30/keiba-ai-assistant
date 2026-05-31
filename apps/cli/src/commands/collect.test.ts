import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { afterEach, describe, expect, test } from "vitest";
import { registerCollectCommand } from "@keiba-ai-assistant/cli/commands/collect";
import { parseRace, type Race, type RaceSourceSnapshot } from "@keiba-ai-assistant/models";
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

describe("registerCollectCommand", () => {
  test("netKeiba snapshotをAI構造化してrace.jsonを保存できる", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const snapshot = createSnapshot();
    const race = createRace(snapshot);
    const logs: string[] = [];
    const program = createCollectProgram({
      collectRaceSnapshot: async (input) => {
        expect(input).toEqual({
          raceUrl: snapshot.racePage.sourceUrl,
          minDelayMs: 5000,
          horseDetailLimit: 1,
          headless: true
        });
        return snapshot;
      },
      extractRaceFromSnapshot: async (input) => {
        expect(input.snapshot).toEqual(snapshot);
        expect(input.model).toBe("fixture-codex-model");
        return race;
      },
      log: (message) => {
        logs.push(message);
      }
    });

    // Act
    await program.parseAsync([
      "node",
      "test",
      "collect",
      "--race-url",
      snapshot.racePage.sourceUrl,
      "--runs-dir",
      rootDir,
      "--model",
      "fixture-codex-model",
      "--min-delay-ms",
      "5000",
      "--horse-detail-limit",
      "1",
      "--headless"
    ]);
    const actual = await readRace(race.id, { rootDir });

    // Assert
    expect(actual).toEqual(race);
    expect(logs).toEqual([`race.json を保存しました: ${race.id}`]);
  });

  test("AI構造化に失敗した場合はrace.jsonを保存しない", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const snapshot = createSnapshot();
    const program = createCollectProgram({
      collectRaceSnapshot: async () => snapshot,
      extractRaceFromSnapshot: async () => {
        throw new Error("extract failed");
      },
      log: () => {}
    });

    // Act
    const actual = program.parseAsync([
      "node",
      "test",
      "collect",
      "--race-url",
      snapshot.racePage.sourceUrl,
      "--runs-dir",
      rootDir
    ]);

    // Assert
    await expect(actual).rejects.toThrow("extract failed");
    await expect(listRuns({ rootDir })).resolves.toEqual([]);
  });
});

/** collect コマンドだけを登録したテスト用 Commander program を作る。 */
const createCollectProgram = (
  dependencies: Parameters<typeof registerCollectCommand>[1]
): Command => {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeErr: () => {},
    writeOut: () => {}
  });
  registerCollectCommand(program, dependencies);
  return program;
};

/** collect コマンドテスト用のページsnapshotを作る。 */
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
    ]
  };
};

/** collect コマンドテスト用のRaceを作る。 */
const createRace = (snapshot: RaceSourceSnapshot): Race => {
  return parseRace({
    id: "fixture-aoba-mile-2026",
    sourceUrl: snapshot.racePage.sourceUrl,
    name: "青葉架空マイル",
    racecourse: "東京",
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

/** 後片付け対象として記録した一時ディレクトリを作る。 */
const createTempRootDir = async (): Promise<string> => {
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-collect-command-"));
  tempRootDirs.push(rootDir);
  return rootDir;
};
