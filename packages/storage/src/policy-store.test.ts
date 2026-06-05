import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { readPredictionPolicy, type PolicyStoreOptions } from "@keiba-ai-assistant/storage";

const tempRootDirs: string[] = [];

afterEach(async () => {
  // Arrange
  const rootDirs = tempRootDirs.splice(0);

  // Act
  await Promise.all(rootDirs.map((rootDir) => rm(rootDir, { recursive: true, force: true })));

  // Assert
  expect(tempRootDirs).toHaveLength(0);
});

describe("policy-store", () => {
  test("予想方針ディレクトリ内のmdファイルをファイル名順に結合できる", async () => {
    // Arrange
    const policyDir = await createTempRootDir();
    await writeFile(join(policyDir, "20-bets.md"), "買い目では期待値を重視する。", "utf8");
    await writeFile(join(policyDir, "10-base.md"), "芝マイルでは持続力を重視する。", "utf8");
    await writeFile(join(policyDir, "policy.md.example"), "このサンプルは読み込まない。", "utf8");
    const options: PolicyStoreOptions = {
      policyDir,
      now: () => new Date("2026-05-31T15:00:00+09:00")
    };

    // Act
    const actual = await readPredictionPolicy(options);

    // Assert
    expect(actual).toEqual({
      path: policyDir,
      content: "芝マイルでは持続力を重視する。\n\n買い目では期待値を重視する。",
      loadedAt: "2026-05-31T06:00:00.000Z"
    });
  });

  test("互換用の予想方針ファイルを PredictionPolicy として読み込める", async () => {
    // Arrange
    const policyPath = await writeTempPolicyFile("芝マイルでは持続力を重視する。");
    const options: PolicyStoreOptions = {
      policyPath,
      now: () => new Date("2026-05-31T15:00:00+09:00")
    };

    // Act
    const actual = await readPredictionPolicy(options);

    // Assert
    expect(actual).toEqual({
      path: policyPath,
      content: "芝マイルでは持続力を重視する。",
      loadedAt: "2026-05-31T06:00:00.000Z"
    });
  });

  test("予想方針ディレクトリが存在しない場合は分かりやすいエラーにする", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const policyDir = join(rootDir, "missing-policies");

    // Act
    const actual = readPredictionPolicy({ policyDir });

    // Assert
    await expect(actual).rejects.toThrow(`予想方針ディレクトリが見つかりません: ${policyDir}`);
  });

  test("予想方針ディレクトリにmdファイルがない場合は分かりやすいエラーにする", async () => {
    // Arrange
    const policyDir = await createTempRootDir();
    await writeFile(join(policyDir, "policy.md.example"), "サンプルだけでは読み込まない。", "utf8");

    // Act
    const actual = readPredictionPolicy({ policyDir });

    // Assert
    await expect(actual).rejects.toThrow(
      `予想方針ディレクトリに .md ファイルがありません: ${policyDir}`
    );
  });

  test("予想方針ファイルが存在しない場合は分かりやすいエラーにする", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const policyPath = join(rootDir, "missing-main.md");

    // Act
    const actual = readPredictionPolicy({ policyPath });

    // Assert
    await expect(actual).rejects.toThrow(`予想方針ファイルが見つかりません: ${policyPath}`);
  });

  test("予想方針ディレクトリとファイルを同時に指定した場合はエラーにする", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const policyPath = join(rootDir, "main.md");

    // Act
    const actual = readPredictionPolicy({ policyDir: rootDir, policyPath });

    // Assert
    await expect(actual).rejects.toThrow("policyDir と policyPath は同時に指定できません。");
  });
});

const writeTempPolicyFile = async (content: string): Promise<string> => {
  const rootDir = await createTempRootDir();
  const policyPath = join(rootDir, "main.md");
  await writeFile(policyPath, content, "utf8");
  return policyPath;
};

const createTempRootDir = async (): Promise<string> => {
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-policy-store-"));
  tempRootDirs.push(rootDir);
  return rootDir;
};
