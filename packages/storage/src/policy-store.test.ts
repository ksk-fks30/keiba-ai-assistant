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
  test("予想方針ファイルを PredictionPolicy として読み込める", async () => {
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

  test("予想方針ファイルが存在しない場合は分かりやすいエラーにする", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const policyPath = join(rootDir, "missing-main.md");

    // Act
    const actual = readPredictionPolicy({ policyPath });

    // Assert
    await expect(actual).rejects.toThrow(`予想方針ファイルが見つかりません: ${policyPath}`);
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
