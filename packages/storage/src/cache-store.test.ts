import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { readCache, writeCache, type CacheStoreOptions } from "@keiba-ai-assistant/storage";
import { getCachePath } from "@keiba-ai-assistant/storage/cache-store";

interface CachePayload {
  raceId: string;
  values: number[];
}

const tempRootDirs: string[] = [];

afterEach(async () => {
  // Arrange
  const rootDirs = tempRootDirs.splice(0);

  // Act
  await Promise.all(rootDirs.map((rootDir) => rm(rootDir, { recursive: true, force: true })));

  // Assert
  expect(tempRootDirs).toHaveLength(0);
});

describe("cache-store", () => {
  test("ネストしたcwdからでもデフォルトのcache保存先はリポジトリルートのdata/cacheになる", () => {
    // Arrange
    const workspaceRoot = process.cwd();
    const nestedCwd = join(workspaceRoot, "apps", "cli");
    const key = "fixture-race-cache";
    let actual = "";

    process.chdir(nestedCwd);
    try {
      // Act
      actual = getCachePath(key);
    } finally {
      process.chdir(workspaceRoot);
    }

    // Assert
    expect(actual).toBe(join(workspaceRoot, "data", "cache", `${encodeURIComponent(key)}.json`));
  });

  test("保存した cache を読み込める", async () => {
    // Arrange
    const options = await createTempCacheStoreOptions();
    const key = "fixture-race-cache";
    const payload: CachePayload = {
      raceId: "fixture-aoba-mile-2026",
      values: [1, 2, 3]
    };

    // Act
    await writeCache(key, payload, options);
    const actual = await readCache<CachePayload>(key, options);

    // Assert
    expect(actual).toEqual(payload);
  });

  test("存在しない cache は null として読み込める", async () => {
    // Arrange
    const options = await createTempCacheStoreOptions();

    // Act
    const actual = await readCache<CachePayload>("missing-cache", options);

    // Assert
    expect(actual).toBeNull();
  });

  test("cache key をファイル名として encode して保存できる", async () => {
    // Arrange
    const rootDir = await createTempRootDir();
    const options: CacheStoreOptions = { rootDir };
    const key = "https://example.com/races?id=fixture aoba";
    const payload = { cached: true };

    // Act
    await writeCache(key, payload, options);
    const fileContent = await readFile(join(rootDir, `${encodeURIComponent(key)}.json`), "utf8");

    // Assert
    expect(JSON.parse(fileContent) as unknown).toEqual(payload);
  });
});

const createTempCacheStoreOptions = async (): Promise<CacheStoreOptions> => {
  const rootDir = await createTempRootDir();
  return { rootDir };
};

const createTempRootDir = async (): Promise<string> => {
  const rootDir = await mkdtemp(join(tmpdir(), "keiba-ai-cache-store-"));
  tempRootDirs.push(rootDir);
  return rootDir;
};
