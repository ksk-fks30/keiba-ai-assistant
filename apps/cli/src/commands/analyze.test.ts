import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { afterEach, describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace, type Prediction } from "@keiba-ai-assistant/models";
import { registerAnalyzeCommand } from "@keiba-ai-assistant/cli/commands/analyze";
import { readPrediction, writeRace } from "@keiba-ai-assistant/storage";

const tempRootDirs: string[] = [];

afterEach(async () => {
  // Arrange
  const rootDirs = tempRootDirs.splice(0);

  // Act
  await Promise.all(rootDirs.map((rootDir) => rm(rootDir, { recursive: true, force: true })));

  // Assert
  expect(tempRootDirs).toHaveLength(0);
});

describe("registerAnalyzeCommand", () => {
  test("保存済み run と予想方針を読み込んで prediction.json を保存できる", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const race = parseRace(sampleRace);
    const policyPath = await writeTempPolicyFile("芝マイルでは持続力を重視する。");
    const prediction = createPrediction(race.id);
    const logs: string[] = [];
    await writeRace(race, { rootDir });
    const program = createAnalyzeProgram({
      analyzeRace: async (input) => {
        expect(input.race).toEqual(race);
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
      "analyze",
      race.id,
      "--runs-dir",
      rootDir,
      "--policy-path",
      policyPath,
      "--model",
      "fixture-codex-model"
    ]);
    const actual = await readPrediction(race.id, { rootDir });

    // Assert
    expect(actual).toEqual(prediction);
    expect(logs).toEqual([
      `保存済みレースを読み込んでいます: ${race.id}`,
      "予想方針を読み込んでいます。",
      "Codexで予想分析を実行しています。",
      "prediction.json を保存しています。",
      `prediction.json を保存しました: ${race.id}`
    ]);
  });

  test("分析に失敗した場合は prediction.json を残さない", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const race = parseRace(sampleRace);
    const policyPath = await writeTempPolicyFile("芝マイルでは持続力を重視する。");
    await writeRace(race, { rootDir });
    const program = createAnalyzeProgram({
      analyzeRace: async () => {
        throw new Error("analysis failed");
      },
      log: () => {}
    });

    // Act
    const actual = program.parseAsync([
      "node",
      "test",
      "analyze",
      race.id,
      "--runs-dir",
      rootDir,
      "--policy-path",
      policyPath
    ]);

    // Assert
    await expect(actual).rejects.toThrow("analysis failed");
    await expect(readPrediction(race.id, { rootDir })).rejects.toThrow();
  });
});

/** analyze コマンドだけを登録したテスト用 Commander program を作る。 */
const createAnalyzeProgram = (
  dependencies: Parameters<typeof registerAnalyzeCommand>[1]
): Command => {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeErr: () => {},
    writeOut: () => {}
  });
  registerAnalyzeCommand(program, dependencies);
  return program;
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
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-analyze-command-"));
  tempRootDirs.push(rootDir);
  return rootDir;
};
