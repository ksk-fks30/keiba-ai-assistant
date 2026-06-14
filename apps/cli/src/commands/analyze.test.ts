import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { afterEach, describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import {
  parseRace,
  type LessonEntry,
  type Prediction,
  type PredictionLessonReference
} from "@keiba-ai-assistant/models";
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
    const lesson = createLessonEntry();
    const prediction = createPrediction(race.id, [
      {
        lessonId: lesson.id,
        title: lesson.title,
        reason: "前残り傾向が近いため。"
      }
    ]);
    const recordedReferences: PredictionLessonReference[] = [];
    const logs: string[] = [];
    await writeRace(race, { rootDir });
    const program = createAnalyzeProgram({
      searchLessonEntries: async (input) => {
        expect(input).toBeDefined();
        if (input === undefined) {
          throw new Error("Lesson検索入力が渡されていません。");
        }
        expect(input.status).toBe("approved");
        expect(input.limit).toBe(10);
        expect(input.tags).toContain("芝");
        return [{ lesson, score: 12, matchedTags: ["芝"] }];
      },
      analyzeRace: async (input) => {
        expect(input.race).toEqual(race);
        expect(input.policy.content).toBe("芝マイルでは持続力を重視する。");
        expect(input.model).toBe("fixture-codex-model");
        expect(input.lessonCandidates).toEqual([lesson]);
        expect(input.jockeyLeadingReference).toBe("騎手リーディング抜粋");
        return prediction;
      },
      readJockeyLeadingReferenceForRace: async (input) => {
        expect(input).toEqual(race);
        return "騎手リーディング抜粋";
      },
      recordPredictionLessonReferences: async (references) => {
        recordedReferences.push(...references);
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
    expect(recordedReferences).toEqual([
      {
        raceId: race.id,
        predictionId: `${race.id}:${prediction.generatedAt}`,
        lessonId: lesson.id,
        reason: "前残り傾向が近いため。",
        usedAt: prediction.generatedAt
      }
    ]);
    expect(logs).toEqual([
      `保存済みレースを読み込んでいます: ${race.id}`,
      "過去の反省Lesson候補を検索しています。",
      "Lesson候補を 1 件見つけました。",
      "予想方針を読み込んでいます。",
      "Codexで予想分析を実行しています。",
      "prediction.json を保存しています。",
      "採用されたLesson参照履歴を保存しています。",
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
      searchLessonEntries: async () => [],
      analyzeRace: async () => {
        throw new Error("analysis failed");
      },
      readJockeyLeadingReferenceForRace: async () => undefined,
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
const createPrediction = (
  raceId: string,
  referencedLessons: Prediction["referencedLessons"] = []
): Prediction => {
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
    referencedLessons,
    generatedAt: "2026-05-31T14:40:00+09:00"
  };
};

/** CLI 保存確認で使う最小限のLesson fixtureを作る。 */
const createLessonEntry = (): LessonEntry => {
  return {
    id: "lesson-fixture-001",
    sourceRaceId: "fixture-aoba-mile-2026",
    status: "approved",
    title: "前残り傾向では人気薄先行馬を残す",
    situationKey: "芝1600m・前残り・人気薄先行馬",
    tags: ["芝", "前残り", "先行"],
    diaryText: "架空レースでは前残り傾向で先行馬を軽視した。",
    decisionGuidance: "前残り傾向が明確なら人気薄でも先行馬を相手に残す。",
    applicableWhen: ["前が止まりにくい馬場"],
    notApplicableWhen: ["差しが届く馬場"],
    confidence: "medium",
    createdAt: "2026-06-06T12:00:00.000Z",
    updatedAt: "2026-06-06T12:00:00.000Z"
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
