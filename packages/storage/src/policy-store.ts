import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parsePredictionPolicy, type PredictionPolicy } from "@keiba-ai-assistant/models";
import { isMissingFileError } from "@keiba-ai-assistant/storage/file-system";

export interface PolicyStoreOptions {
  /** 読み込む予想方針ファイルのパス。未指定時は `policies/main.md` を使用する。 */
  policyPath?: string | undefined;
  /** 読込日時を生成する関数。テストでは固定時刻を渡せる。 */
  now?: (() => Date) | undefined;
}

const defaultPolicyPath = fileURLToPath(new URL("../../../policies/main.md", import.meta.url));

/** 予想方針ファイルのパスを返す。 */
export const getPolicyPath = (options: PolicyStoreOptions = {}): string => {
  return options.policyPath ?? defaultPolicyPath;
};

/** 予想方針ファイルを読み込み、PredictionPolicy モデルとして検証して返す。 */
export const readPredictionPolicy = async (
  options: PolicyStoreOptions = {}
): Promise<PredictionPolicy> => {
  const path = getPolicyPath(options);

  try {
    return parsePredictionPolicy({
      path,
      content: await readFile(path, "utf8"),
      loadedAt: (options.now?.() ?? new Date()).toISOString()
    });
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(`予想方針ファイルが見つかりません: ${path}`);
    }
    throw error;
  }
};
