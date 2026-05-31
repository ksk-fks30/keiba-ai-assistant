import { access } from "node:fs/promises";

/** 指定したパスにファイルまたはディレクトリが存在するかを返す。 */
export const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
};

/** fs 系 API の ENOENT エラーかどうかを判定する。 */
export const isMissingFileError = (error: unknown): boolean => {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
};
