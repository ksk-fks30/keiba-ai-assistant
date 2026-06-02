import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isMissingFileError } from "@keiba-ai-assistant/storage/file-system";
import { getWorkspacePath } from "@keiba-ai-assistant/storage/workspace-root";

export interface CacheStoreOptions {
  rootDir?: string;
}

const defaultCacheRootDirSegments = ["data", "cache"] as const;

export const getCachePath = (key: string, options: CacheStoreOptions = {}): string => {
  return join(resolveRootDir(options), `${encodeURIComponent(key)}.json`);
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
  const rootDir = resolveRootDir(options);
  await mkdir(rootDir, { recursive: true });
  await writeFile(getCachePath(key, options), `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

/** cache 保存先のルートディレクトリをオプションまたは workspace root から解決する。 */
const resolveRootDir = (options: CacheStoreOptions = {}): string => {
  return options.rootDir ?? getDefaultRootDir();
};

/** workspace root 直下の `data/cache` をデフォルトの cache 保存先として返す。 */
const getDefaultRootDir = (): string => {
  return getWorkspacePath(...defaultCacheRootDirSegments);
};
