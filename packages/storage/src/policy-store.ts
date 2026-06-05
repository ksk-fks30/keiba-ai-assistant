import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePredictionPolicy, type PredictionPolicy } from "@keiba-ai-assistant/models";
import { isMissingFileError } from "@keiba-ai-assistant/storage/file-system";

export interface PolicyStoreOptions {
  /** 読み込む予想方針ディレクトリのパス。未指定時は `policies/` を使用する。 */
  policyDir?: string | undefined;
  /** 互換用に読み込む単一の予想方針ファイルのパス。 */
  policyPath?: string | undefined;
  /** 読込日時を生成する関数。テストでは固定時刻を渡せる。 */
  now?: (() => Date) | undefined;
}

const defaultPolicyDir = fileURLToPath(new URL("../../../policies", import.meta.url));

/** 予想方針ディレクトリのパスを返す。 */
export const getPolicyDirectory = (options: PolicyStoreOptions = {}): string => {
  return options.policyDir ?? defaultPolicyDir;
};

/** 予想方針の読み込み元パスを返す。 */
export const getPolicyPath = (options: PolicyStoreOptions = {}): string => {
  return options.policyPath ?? getPolicyDirectory(options);
};

/** 予想方針ファイルを読み込み、PredictionPolicy モデルとして検証して返す。 */
export const readPredictionPolicy = async (
  options: PolicyStoreOptions = {}
): Promise<PredictionPolicy> => {
  if (options.policyDir !== undefined && options.policyPath !== undefined) {
    throw new Error("policyDir と policyPath は同時に指定できません。");
  }

  const path = getPolicyPath(options);
  const content =
    options.policyPath === undefined
      ? await readPolicyDirectory(path)
      : await readPolicyFile(options.policyPath);

  return parsePredictionPolicy({
    path,
    content,
    loadedAt: (options.now?.() ?? new Date()).toISOString()
  });
};

/** 互換用に単一の予想方針ファイルを読み込む。 */
const readPolicyFile = async (policyPath: string): Promise<string> => {
  try {
    return await readFile(policyPath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(`予想方針ファイルが見つかりません: ${policyPath}`);
    }
    throw error;
  }
};

/** 予想方針ディレクトリ内の .md ファイルをファイル名順に読み込んで結合する。 */
const readPolicyDirectory = async (policyDir: string): Promise<string> => {
  const fileNames = await listPolicyFileNames(policyDir);
  const contents = await Promise.all(
    fileNames.map((fileName) => readPolicyFile(join(policyDir, fileName)))
  );

  return contents.join("\n\n");
};

/** 予想方針ディレクトリ内の .md ファイル名をアルファベット順で返す。 */
const listPolicyFileNames = async (policyDir: string): Promise<string[]> => {
  try {
    const entries = await readdir(policyDir, { withFileTypes: true });
    const fileNames = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, "en"));

    if (fileNames.length === 0) {
      throw new Error(`予想方針ディレクトリに .md ファイルがありません: ${policyDir}`);
    }

    return fileNames;
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(`予想方針ディレクトリが見つかりません: ${policyDir}`);
    }
    throw error;
  }
};
