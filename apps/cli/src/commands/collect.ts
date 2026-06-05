import type { Command } from "commander";
import { extractRaceFromSnapshot } from "@keiba-ai-assistant/ai";
import { parseRace, type Race, type Weather } from "@keiba-ai-assistant/models";
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
  raceUrl?: string | undefined;
  /** runs ディレクトリのルートパス。 */
  runsDir?: string | undefined;
  /** この抽出で利用する Codex モデル名。 */
  model?: string | undefined;
  /** ページ表示後に最低限待機する時間。ミリ秒文字列。 */
  minDelayMs?: string | undefined;
  /** レースページから遷移して取得する馬詳細ページの最大件数。未指定なら全頭。 */
  horseDetailLimit?: string | undefined;
  /** Chromium を headless で起動するかどうか。 */
  headless?: boolean | undefined;
  /** Chromium の画面を表示して起動するかどうか。 */
  showBrowser?: boolean | undefined;
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
    .argument("[raceUrl]", "netKeiba race URL")
    .option("--race-url <url>", "netKeiba race URL")
    .option("--runs-dir <path>", "Runs root directory")
    .option("--model <model>", "Codex model name")
    .option("--min-delay-ms <ms>", "Minimum delay after page load in milliseconds")
    .option(
      "--horse-detail-limit <count>",
      "Maximum horse detail pages to visit; omitted means all horses"
    )
    .option("--headless", "Run browser in headless mode")
    .option("--show-browser", "Run browser with a visible window")
    .action(async (raceUrl: string | undefined, options: CollectCommandOptions) => {
      deps.log("レース取得を開始します。");
      const snapshot = await deps.collectRaceSnapshot(
        buildCollectRaceSnapshotInput(raceUrl, options, deps.log)
      );
      deps.log("AIでレース情報を構造化しています。");
      const race = await deps.extractRaceFromSnapshot({
        snapshot,
        ...buildExtractRaceOptions(options)
      });
      deps.log(`レース情報を構造化しました: ${race.name} (${race.id})`);
      deps.log("Open-Meteoから天気情報を取得しています。");
      const raceWithWeather = await attachWeather(race, deps.weatherProvider, deps.log);

      deps.log("race.json を保存しています。");
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
    log(`天気情報を取得しました: ${formatWeatherSummary(weather)}`);

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

/** Weather をCLI進捗に出しやすい短い表記へ整える。 */
const formatWeatherSummary = (weather: Weather): string => {
  const parts = [
    weather.condition,
    formatTemperature(weather.temperatureCelsius),
    formatPrecipitationProbability(weather.precipitationProbability),
    weather.wind
  ].filter(isNonEmptyText);

  if (parts.length === 0) {
    return "詳細なし";
  }

  return parts.join(" / ");
};

/** 気温をCLI表示用の短い表記へ整える。 */
const formatTemperature = (temperature: number | undefined): string | undefined => {
  if (temperature === undefined) {
    return undefined;
  }

  return `${temperature}℃`;
};

/** 降水確率をCLI表示用の短い表記へ整える。 */
const formatPrecipitationProbability = (probability: number | undefined): string | undefined => {
  if (probability === undefined) {
    return undefined;
  }

  return `降水${probability}%`;
};

/** 空ではない文字列かどうかを判定する。 */
const isNonEmptyText = (value: string | undefined): value is string => {
  return value !== undefined && value.length > 0;
};

/** CLI オプションから netKeiba snapshot 取得設定を組み立てる。 */
const buildCollectRaceSnapshotInput = (
  raceUrl: string | undefined,
  options: CollectCommandOptions,
  log: (message: string) => void
): CollectRaceSnapshotInput => {
  const input: CollectRaceSnapshotInput = {
    raceUrl: resolveRaceUrl(raceUrl, options),
    headless: resolveHeadless(options),
    onProgress: log
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
  return input;
};

/** 位置引数と互換オプションから取得対象URLを決める。 */
const resolveRaceUrl = (raceUrl: string | undefined, options: CollectCommandOptions): string => {
  if (raceUrl !== undefined && options.raceUrl !== undefined && raceUrl !== options.raceUrl) {
    throw new Error("race URL は位置引数または --race-url のどちらか一方で指定してください。");
  }
  if (raceUrl !== undefined) {
    return raceUrl;
  }
  if (options.raceUrl !== undefined) {
    return options.raceUrl;
  }

  throw new Error("race URL を指定してください。例: pnpm keiba:cli collect <race-url>");
};

/** CLI collect のブラウザ表示設定を決める。 */
const resolveHeadless = (options: CollectCommandOptions): boolean => {
  if (options.headless === true && options.showBrowser === true) {
    throw new Error("--headless と --show-browser は同時に指定できません。");
  }
  if (options.showBrowser === true) {
    return false;
  }

  return true;
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
