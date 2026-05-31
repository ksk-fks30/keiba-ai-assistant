import type { Command } from "commander";
import { extractRaceFromSnapshot } from "@keiba-ai-assistant/ai";
import { parseRace, type Race } from "@keiba-ai-assistant/models";
import {
  collectRaceSnapshotFromNetkeiba,
  createOpenMeteoWeatherProvider,
  type CollectRaceSnapshotInput
} from "@keiba-ai-assistant/scraper";
import type { WeatherProvider } from "@keiba-ai-assistant/scraper/weather/provider";
import { writeRace, type RunStoreOptions } from "@keiba-ai-assistant/storage";

/** collect コマンドが受け取る CLI オプション。 */
interface CollectCommandOptions {
  /** 取得対象の netKeiba レースURL。 */
  raceUrl: string;
  /** runs ディレクトリのルートパス。 */
  runsDir?: string | undefined;
  /** この抽出で利用する Codex モデル名。 */
  model?: string | undefined;
  /** ページ表示後に最低限待機する時間。ミリ秒文字列。 */
  minDelayMs?: string | undefined;
  /** レースページから遷移して取得する馬詳細ページの最大件数。 */
  horseDetailLimit?: string | undefined;
  /** Chromium を headless で起動するかどうか。 */
  headless?: boolean | undefined;
}

/** collect コマンドのテスト差し替え用依存関係。 */
export interface CollectCommandDependencies {
  /** netKeiba レースページを開き、AI構造化用の軽量snapshotを取得する関数。 */
  collectRaceSnapshot?: typeof collectRaceSnapshotFromNetkeiba | undefined;
  /** ページsnapshotをRaceモデルへ構造化する関数。 */
  extractRaceFromSnapshot?: typeof extractRaceFromSnapshot | undefined;
  /** Open-MeteoなどからRaceに紐づく天気を取得するprovider。 */
  weatherProvider?: WeatherProvider | undefined;
  /** Race モデルを run store へ保存する関数。 */
  writeRace?: typeof writeRace | undefined;
  /** CLI にメッセージを出力する関数。 */
  log?: ((message: string) => void) | undefined;
}

/** netKeiba のレースURLからsnapshot取得、AI構造化、race.json保存を行う CLI コマンドを登録する。 */
export const registerCollectCommand = (
  program: Command,
  dependencies: CollectCommandDependencies = {}
): void => {
  const defaultWeatherProvider = createOpenMeteoWeatherProvider();
  const deps = {
    collectRaceSnapshot: dependencies.collectRaceSnapshot ?? collectRaceSnapshotFromNetkeiba,
    extractRaceFromSnapshot: dependencies.extractRaceFromSnapshot ?? extractRaceFromSnapshot,
    weatherProvider: dependencies.weatherProvider ?? defaultWeatherProvider,
    writeRace: dependencies.writeRace ?? writeRace,
    log: dependencies.log ?? console.log
  };

  program
    .command("collect")
    .description("Collect race data from netKeiba")
    .requiredOption("--race-url <url>", "netKeiba race URL")
    .option("--runs-dir <path>", "Runs root directory")
    .option("--model <model>", "Codex model name")
    .option("--min-delay-ms <ms>", "Minimum delay after page load in milliseconds")
    .option("--horse-detail-limit <count>", "Maximum horse detail pages to visit")
    .option("--headless", "Run browser in headless mode")
    .action(async (options: CollectCommandOptions) => {
      const snapshot = await deps.collectRaceSnapshot(buildCollectRaceSnapshotInput(options));
      const race = await deps.extractRaceFromSnapshot({
        snapshot,
        ...buildExtractRaceOptions(options)
      });
      const raceWithWeather = await attachWeather(race, deps.weatherProvider, deps.log);

      await deps.writeRace(raceWithWeather, buildRunStoreOptions(options));
      deps.log(`race.json を保存しました: ${raceWithWeather.id}`);
    });
};

/** RaceにOpen-Meteo由来の天気情報を付与し、保存前にRaceとして再検証する。 */
const attachWeather = async (
  race: Race,
  weatherProvider: WeatherProvider,
  log: (message: string) => void
): Promise<Race> => {
  try {
    const weather = await weatherProvider.getWeather({
      racecourse: race.racecourse,
      raceStartTime: race.startTime
    });

    return parseRace({
      ...race,
      weather
    });
  } catch (error) {
    // 天気は補助情報なので、Open-Meteo 側の未対応や一時失敗ではレース保存を継続する。
    log(`天気情報を保存しませんでした: ${readErrorMessage(error)}`);
    return race;
  }
};

/** unknown の例外値からCLI表示用メッセージを取り出す。 */
const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

/** CLI オプションから netKeiba snapshot 取得設定を組み立てる。 */
const buildCollectRaceSnapshotInput = (
  options: CollectCommandOptions
): CollectRaceSnapshotInput => {
  const input: CollectRaceSnapshotInput = {
    raceUrl: options.raceUrl
  };

  if (options.minDelayMs !== undefined) {
    input.minDelayMs = parsePositiveIntegerOption(options.minDelayMs, "--min-delay-ms");
  }
  if (options.horseDetailLimit !== undefined) {
    input.horseDetailLimit = parseNonNegativeIntegerOption(
      options.horseDetailLimit,
      "--horse-detail-limit"
    );
  }
  if (options.headless !== undefined) {
    input.headless = options.headless;
  }

  return input;
};

/** CLI オプションから AI 抽出設定を組み立てる。 */
const buildExtractRaceOptions = (options: CollectCommandOptions) => {
  if (options.model === undefined) {
    return {};
  }

  return { model: options.model };
};

/** CLI オプションから run store の読み書き設定を組み立てる。 */
const buildRunStoreOptions = (options: CollectCommandOptions): RunStoreOptions => {
  if (options.runsDir === undefined) {
    return {};
  }

  return { rootDir: options.runsDir };
};

/** 1以上の整数として扱う CLI オプションを検証して number に変換する。 */
const parsePositiveIntegerOption = (value: string, optionName: string): number => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed.toString() !== value) {
    throw new Error(`${optionName} は1以上の整数で指定してください。`);
  }

  return parsed;
};

/** 0以上の整数として扱う CLI オプションを検証して number に変換する。 */
const parseNonNegativeIntegerOption = (value: string, optionName: string): number => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed.toString() !== value) {
    throw new Error(`${optionName} は0以上の整数で指定してください。`);
  }

  return parsed;
};
