import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { fileExists, isMissingFileError } from "@keiba-ai-assistant/storage/file-system";

const tempRootDirs: string[] = [];

afterEach(async () => {
  // Arrange
  const rootDirs = tempRootDirs.splice(0);

  // Act
  await Promise.all(rootDirs.map((rootDir) => rm(rootDir, { recursive: true, force: true })));

  // Assert
  expect(tempRootDirs).toHaveLength(0);
});

describe("file-system", () => {
  test("存在するファイルは true を返す", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const path = join(rootDir, "fixture.txt");
    await writeFile(path, "fixture", "utf8");

    // Act
    const actual = await fileExists(path);

    // Assert
    expect(actual).toBe(true);
  });

  test("存在しないファイルは false を返す", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const path = join(rootDir, "missing.txt");

    // Act
    const actual = await fileExists(path);

    // Assert
    expect(actual).toBe(false);
  });

  test("ENOENT エラーを missing file error として判定できる", () => {
    // Arrange
    const error = Object.assign(new Error("missing"), { code: "ENOENT" });

    // Act
    const actual = isMissingFileError(error);

    // Assert
    expect(actual).toBe(true);
  });
});

/** 後片付け対象として記録した一時ディレクトリを作る。 */
const createTempRootDir = async (): Promise<string> => {
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-file-system-"));
  tempRootDirs.push(rootDir);
  return rootDir;
};
