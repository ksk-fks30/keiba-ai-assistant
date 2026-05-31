import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parsePrediction, parseRace, type Prediction, type Race } from "@keiba-ai-assistant/models";
import { fileExists, isMissingFileError } from "@keiba-ai-assistant/storage/file-system";

export interface RunStoreOptions {
  /** run データを保存するルートディレクトリ。未指定時は `runs` を使用する。 */
  rootDir?: string;
}

/** run 一覧で返す、レース単位の保存状態サマリー。 */
export interface RunSummary {
  /** run の識別子。現状は対象レースIDと同じ値を使う。 */
  raceId: string;
  /** `race.json` が保存済みかどうか。 */
  hasRace: boolean;
  /** `prediction.json` が保存済みかどうか。 */
  hasPrediction: boolean;
  /** `qa.jsonl` が保存済みかどうか。 */
  hasQa: boolean;
  /** run ディレクトリの最終更新日時。 */
  updatedAt: string;
}

const defaultRootDir = "runs" as const;
const raceFileName = "race.json" as const;
const predictionFileName = "prediction.json" as const;
const qaFileName = "qa.jsonl" as const;

/** 指定したレースIDに対応する run ディレクトリのパスを返す。 */
export const getRunDir = (raceId: string, options: RunStoreOptions = {}): string => {
  return join(options.rootDir ?? defaultRootDir, raceId);
};

/** 指定したレースIDに対応する run ディレクトリを作成する。 */
export const createRun = async (raceId: string, options: RunStoreOptions = {}): Promise<void> => {
  await ensureRunDir(raceId, options);
};

/** 指定したレースIDに対応する run ディレクトリを作成し、そのパスを返す。 */
export const ensureRunDir = async (
  raceId: string,
  options: RunStoreOptions = {}
): Promise<string> => {
  const runDir = getRunDir(raceId, options);
  await mkdir(runDir, { recursive: true });
  return runDir;
};

/** 指定したレースIDの run ディレクトリが存在するかを返す。 */
export const runExists = async (
  raceId: string,
  options: RunStoreOptions = {}
): Promise<boolean> => {
  try {
    return (await stat(getRunDir(raceId, options))).isDirectory();
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
};

/** run ルート配下に存在する run ディレクトリの保存状態一覧を返す。 */
export const listRuns = async (options: RunStoreOptions = {}): Promise<RunSummary[]> => {
  const rootDir = options.rootDir ?? defaultRootDir;
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    const raceIds = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    return await Promise.all(raceIds.map((raceId) => readRunSummary(raceId, options)));
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }
};

/** Race モデルを検証して、対象 run の `race.json` に保存する。 */
export const writeRace = async (race: Race, options: RunStoreOptions = {}): Promise<void> => {
  const runDir = await ensureRunDir(race.id, options);
  await writeJson(join(runDir, raceFileName), parseRace(race));
};

/** 対象 run の `race.json` を読み込み、Race モデルとして検証して返す。 */
export const readRace = async (raceId: string, options: RunStoreOptions = {}): Promise<Race> => {
  const json = await readJson(join(getRunDir(raceId, options), raceFileName));
  return parseRace(json);
};

/** Prediction モデルを検証して、対象 run の `prediction.json` に保存する。 */
export const writePrediction = async (
  prediction: Prediction,
  options: RunStoreOptions = {}
): Promise<void> => {
  const runDir = await ensureRunDir(prediction.raceId, options);
  await writeJson(join(runDir, predictionFileName), parsePrediction(prediction));
};

/** 対象 run の `prediction.json` を読み込み、Prediction モデルとして検証して返す。 */
export const readPrediction = async (
  raceId: string,
  options: RunStoreOptions = {}
): Promise<Prediction> => {
  const json = await readJson(join(getRunDir(raceId, options), predictionFileName));
  return parsePrediction(json);
};

/** 指定した run ディレクトリ内の保存済みファイル状態を集約して返す。 */
const readRunSummary = async (
  raceId: string,
  options: RunStoreOptions = {}
): Promise<RunSummary> => {
  const runDir = getRunDir(raceId, options);
  const stats = await stat(runDir);

  return {
    raceId,
    hasRace: await fileExists(join(runDir, raceFileName)),
    hasPrediction: await fileExists(join(runDir, predictionFileName)),
    hasQa: await fileExists(join(runDir, qaFileName)),
    updatedAt: stats.mtime.toISOString()
  };
};

/** JSONファイルを読み込み、構造検証前の unknown として返す。 */
const readJson = async (path: string): Promise<unknown> => {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
};

/** 値を整形済みJSONとして指定パスに書き込む。 */
const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
