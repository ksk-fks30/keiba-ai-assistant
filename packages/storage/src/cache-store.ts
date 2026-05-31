import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isMissingFileError } from "@keiba-ai-assistant/storage/file-system";

export interface CacheStoreOptions {
  rootDir?: string;
}

const defaultRootDir = "data/cache";

export const getCachePath = (key: string, options: CacheStoreOptions = {}): string => {
  return join(options.rootDir ?? defaultRootDir, `${encodeURIComponent(key)}.json`);
};

export const readCache = async <T>(
  key: string,
  options: CacheStoreOptions = {}
): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(getCachePath(key, options), "utf8")) as T;
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
};

export const writeCache = async (
  key: string,
  value: unknown,
  options: CacheStoreOptions = {}
): Promise<void> => {
  const rootDir = options.rootDir ?? defaultRootDir;
  await mkdir(rootDir, { recursive: true });
  await writeFile(getCachePath(key, options), `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
