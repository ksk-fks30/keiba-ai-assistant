import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface CacheStoreOptions {
  rootDir?: string;
}

const defaultRootDir = "data/cache";

export function getCachePath(key: string, options: CacheStoreOptions = {}): string {
  return join(options.rootDir ?? defaultRootDir, `${encodeURIComponent(key)}.json`);
}

export async function readCache<T>(
  key: string,
  options: CacheStoreOptions = {}
): Promise<T | null> {
  try {
    return JSON.parse(await readFile(getCachePath(key, options), "utf8")) as T;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeCache(
  key: string,
  value: unknown,
  options: CacheStoreOptions = {}
): Promise<void> {
  const rootDir = options.rootDir ?? defaultRootDir;
  await mkdir(rootDir, { recursive: true });
  await writeFile(getCachePath(key, options), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
