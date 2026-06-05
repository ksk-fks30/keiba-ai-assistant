import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import { parseRace } from "@keiba-ai-assistant/models";
import { writeRace, type RunStoreOptions } from "@keiba-ai-assistant/storage";

/** import-race コマンドが受け取る CLI オプション。 */
interface ImportRaceCommandOptions {
  /** 取り込み対象の構造化済み race JSON ファイルパス。 */
  raceJson?: string | undefined;
  /** runs ディレクトリのルートパス。 */
  runsDir?: string | undefined;
}

/** import-race コマンドのテスト差し替え用依存関係。 */
export interface ImportRaceCommandDependencies {
  /** race JSON ファイルを文字列として読み込む関数。 */
  readRaceJson?: ((path: string) => Promise<string>) | undefined;
  /** Race モデルを run store へ保存する関数。 */
  writeRace?: typeof writeRace | undefined;
  /** CLI にメッセージを出力する関数。 */
  log?: ((message: string) => void) | undefined;
}

/** 構造化済み race JSON を読み込み、対象 run の race.json として保存する CLI コマンドを登録する。 */
export const registerImportRaceCommand = (
  program: Command,
  dependencies: ImportRaceCommandDependencies = {}
): void => {
  // fixture や手作業で作った JSON を、Codex 分析前の保存済み run として取り込む。
  const deps = {
    readRaceJson: dependencies.readRaceJson ?? readRaceJsonFile,
    writeRace: dependencies.writeRace ?? writeRace,
    log: dependencies.log ?? console.log
  };

  program
    .command("import-race")
    .description("Import structured race JSON")
    .argument("[raceJson]", "Race JSON file path")
    .option("--race-json <path>", "Race JSON file path")
    .option("--runs-dir <path>", "Runs root directory")
    .action(async (raceJson: string | undefined, options: ImportRaceCommandOptions) => {
      const resolvedRaceJson = resolveRaceJson(raceJson, options);
      deps.log(`race JSON を読み込んでいます: ${resolvedRaceJson}`);
      const race = parseRace(
        parseRaceJson(await deps.readRaceJson(resolvedRaceJson), resolvedRaceJson)
      );
      deps.log("race.json を保存しています。");
      await deps.writeRace(race, buildRunStoreOptions(options));
      deps.log(`race.json を保存しました: ${race.id}`);
    });
};

/** 位置引数と互換オプションから取り込み対象JSONパスを決める。 */
const resolveRaceJson = (
  raceJson: string | undefined,
  options: ImportRaceCommandOptions
): string => {
  if (raceJson !== undefined && options.raceJson !== undefined && raceJson !== options.raceJson) {
    throw new Error("race JSON は位置引数または --race-json のどちらか一方で指定してください。");
  }
  if (raceJson !== undefined) {
    return raceJson;
  }
  if (options.raceJson !== undefined) {
    return options.raceJson;
  }

  throw new Error("race JSON を指定してください。例: pnpm keiba:cli import-race <race-json>");
};

/** CLI オプションから run store の読み書き設定を組み立てる。 */
const buildRunStoreOptions = (options: ImportRaceCommandOptions): RunStoreOptions => {
  if (options.runsDir === undefined) {
    return {};
  }

  return { rootDir: options.runsDir };
};

/** race JSON ファイルを UTF-8 文字列として読み込む。 */
const readRaceJsonFile = async (path: string): Promise<string> => {
  return readFile(path, "utf8");
};

/** race JSON ファイルの内容を JSON として解釈する。 */
const parseRaceJson = (content: string, path: string): unknown => {
  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error(`race JSON を読み込めません: ${path}`, { cause: error });
  }
};
