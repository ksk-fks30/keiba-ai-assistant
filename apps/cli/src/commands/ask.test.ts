import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { afterEach, describe, expect, test } from "vitest";
import sampleRace from "@fixtures/races/sample-race.json";
import { parseRace, type Prediction, type QaEntry } from "@keiba-ai-assistant/models";
import { registerAskCommand, registerQaHistoryCommand } from "@keiba-ai-assistant/cli/commands/ask";
import {
  appendQaEntry,
  readQaEntries,
  writePrediction,
  writeRace
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

describe("registerAskCommand", () => {
  test("保存済み run とQ&A履歴を読み込んで回答を qa.jsonl に追記できる", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const race = parseRace(sampleRace);
    const prediction = createPrediction(race.id);
    const policyPath = await writeTempPolicyFile("芝マイルでは持続力を重視する。");
    const previousEntry = createQaEntry(race.id, "qa-0001", "本命のリスクは？");
    const nextEntry = createQaEntry(race.id, "qa-0002", "馬場が悪化した場合は？");
    const logs: string[] = [];
    await writeRace(race, { rootDir });
    await writePrediction(prediction, { rootDir });
    await appendQaEntry(previousEntry, { rootDir });
    const program = createAskProgram({
      askRace: async (input) => {
        expect(input.race).toEqual(race);
        expect(input.prediction).toEqual(prediction);
        expect(input.policy.content).toBe("芝マイルでは持続力を重視する。");
        expect(input.history).toEqual([previousEntry]);
        expect(input.question).toBe("馬場が悪化した場合は？");
        expect(input.model).toBe("fixture-codex-model");
        return nextEntry;
      },
      log: (message) => {
        logs.push(message);
      }
    });

    // Act
    await program.parseAsync([
      "node",
      "test",
      "ask",
      race.id,
      "--runs-dir",
      rootDir,
      "--policy-path",
      policyPath,
      "--model",
      "fixture-codex-model",
      "馬場が悪化した場合は？"
    ]);
    const actual = await readQaEntries(race.id, { rootDir });

    // Assert
    expect(actual).toEqual([previousEntry, nextEntry]);
    expect(logs).toEqual([
      `保存済みレースを読み込んでいます: ${race.id}`,
      "Codexで追加質問に回答しています: 馬場が悪化した場合は？",
      "qa.jsonl に回答を追記しています。",
      nextEntry.answer,
      `qa.jsonl に追記しました: ${nextEntry.id}`
    ]);
  });
});

describe("registerQaHistoryCommand", () => {
  test("Q&A履歴を表示できる", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const raceId = "fixture-aoba-mile-2026";
    const entry = createQaEntry(raceId, "qa-0001", "本命のリスクは？");
    const logs: string[] = [];
    await appendQaEntry(entry, { rootDir });
    const program = createAskProgram({
      log: (message) => {
        logs.push(message);
      }
    });

    // Act
    await program.parseAsync(["node", "test", "qa-history", raceId, "--runs-dir", rootDir]);

    // Assert
    expect(logs).toEqual([
      [
        `Q&A履歴: ${raceId}`,
        "",
        "[1] 26/05/31 15:00",
        `Q: ${entry.question}`,
        `A: ${entry.answer}`
      ].join("\n")
    ]);
  });

  test("Q&A履歴が無い場合は空であることを表示できる", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const raceId = "fixture-aoba-mile-2026";
    const logs: string[] = [];
    const program = createAskProgram({
      log: (message) => {
        logs.push(message);
      }
    });

    // Act
    await program.parseAsync(["node", "test", "qa-history", raceId, "--runs-dir", rootDir]);

    // Assert
    expect(logs).toEqual([`Q&A履歴はありません: ${raceId}`]);
  });
});

/** ask 系コマンドだけを登録したテスト用 Commander program を作る。 */
const createAskProgram = (dependencies: Parameters<typeof registerAskCommand>[1]): Command => {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeErr: () => {},
    writeOut: () => {}
  });
  registerAskCommand(program, dependencies);
  registerQaHistoryCommand(program, dependencies);
  return program;
};

/** CLI 追加質問確認で使う最小限の Prediction fixture を作る。 */
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
        stakeWeight: 100
      }
    ],
    generatedAt: "2026-05-31T05:40:00.000Z"
  };
};

/** テストで使う最小限の QaEntry fixture を作る。 */
const createQaEntry = (raceId: string, id: string, question: string): QaEntry => {
  return {
    id,
    raceId,
    question,
    answer: `${question} に対するfixture回答。`,
    createdAt: "2026-05-31T06:00:00.000Z"
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
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-ask-command-"));
  tempRootDirs.push(rootDir);
  return rootDir;
};
