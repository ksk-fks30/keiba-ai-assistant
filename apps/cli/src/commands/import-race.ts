import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import { parseRace } from "@keiba-ai-assistant/models";
import { writeRace, type RunStoreOptions } from "@keiba-ai-assistant/storage";

/** import-race コマンドが受け取る CLI オプション。 */
interface ImportRaceCommandOptions {
  /** 取り込み対象の構造化済み race JSON ファイルパス。 */
  raceJson: string;
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
    .requiredOption("--race-json <path>", "Race JSON file path")
    .option("--runs-dir <path>", "Runs root directory")
    .action(async (options: ImportRaceCommandOptions) => {
      const race = parseRace(
        parseRaceJson(await deps.readRaceJson(options.raceJson), options.raceJson)
      );
      await deps.writeRace(race, buildRunStoreOptions(options));
      deps.log(`race.json を保存しました: ${race.id}`);
    });
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
