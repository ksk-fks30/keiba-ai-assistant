import {
  analyzeRace as generatePrediction,
  extractRaceFromSnapshot as extractRace,
  type AnalyzeRaceInput,
  type ExtractRaceFromSnapshotInput
} from "@keiba-ai-assistant/ai";
import {
  parseRace,
  type Prediction,
  type Race,
  type RaceSourceSnapshot
} from "@keiba-ai-assistant/models";
import {
  collectRaceSnapshotFromNetkeiba,
  createOpenMeteoWeatherProvider,
  type CollectRaceSnapshotInput,
  type WeatherProvider
} from "@keiba-ai-assistant/scraper";
import type { PolicyRepository } from "@keiba-ai-assistant/web/server/repositories/policy-repository";
import type { RunRepository } from "@keiba-ai-assistant/web/server/repositories/run-repository";

/** netKeiba URL からレース取得とAI分析を実行する入力。 */
export interface PredictRaceUseCaseInput {
  /** 解析対象の netKeiba レースURL。 */
  raceUrl: string;
  /** Codex SDKに渡すモデル名。未指定の場合は既定のモデルを使う。 */
  model?: string | undefined;
  /** ページ表示後に最低限待機する時間。ミリ秒単位。 */
  minDelayMs?: number | undefined;
  /** 馬詳細ページの取得上限。未指定なら全頭取得する。 */
  horseDetailLimit?: number | undefined;
  /** レース情報構造化の最大待機時間。未指定の場合は既定値を使う。 */
  extractTimeoutMs?: number | undefined;
  /** 予想分析の最大待機時間。未指定の場合は既定値を使う。 */
  analysisTimeoutMs?: number | undefined;
  /** ジョブ中止など、呼び出し元からの中断通知。 */
  signal?: AbortSignal | undefined;
  /** ジョブコンソールなど呼び出し元へ処理状況を伝える関数。 */
  onProgress?: ((message: string) => void) | undefined;
}

/** レース取得とAI分析の実行結果。 */
export interface PredictRaceUseCaseResult {
  /** 保存された race ID。 */
  raceId: string;
}

/** レース取得とAI分析usecaseの依存関係。 */
export interface PredictRaceUseCaseDependencies {
  /** 保存済みrunを更新するrepository。 */
  runRepository: RunRepository;
  /** 予想方針を取得するrepository。 */
  policyRepository: PolicyRepository;
  /** netKeiba レースページからsnapshotを取得する関数。 */
  collectRaceSnapshot?:
    | ((input: CollectRaceSnapshotInput) => Promise<RaceSourceSnapshot>)
    | undefined;
  /** ページsnapshotをRaceへ構造化する関数。 */
  extractRaceFromSnapshot?: ((input: ExtractRaceFromSnapshotInput) => Promise<Race>) | undefined;
  /** Open-Meteoなどから天気情報を取得するprovider。 */
  weatherProvider?: WeatherProvider | undefined;
  /** Raceと予想方針からPredictionを生成する関数。 */
  analyzeRace?: ((input: AnalyzeRaceInput) => Promise<Prediction>) | undefined;
}

/** netKeiba URL からレース取得、構造化、分析、保存を連続実行するusecase。 */
export type PredictRaceUseCase = (
  input: PredictRaceUseCaseInput
) => Promise<PredictRaceUseCaseResult>;

const defaultExtractTimeoutMs = 30 * 60 * 1000;
const defaultAnalysisTimeoutMs = 30 * 60 * 1000;

/** 依存関係を注入してWeb版predict usecaseを作る。 */
export const createPredictRaceUseCase = (
  dependencies: PredictRaceUseCaseDependencies
): PredictRaceUseCase => {
  const collectRaceSnapshot = dependencies.collectRaceSnapshot ?? collectRaceSnapshotFromNetkeiba;
  const extractRaceFromSnapshot = dependencies.extractRaceFromSnapshot ?? extractRace;
  const weatherProvider = dependencies.weatherProvider ?? createOpenMeteoWeatherProvider();
  const analyzeRace = dependencies.analyzeRace ?? generatePrediction;

  return async (input) => {
    const raceUrl = normalizeNetkeibaRaceUrl(input.raceUrl);
    throwIfAborted(input.signal);
    reportProgress(input, "netKeibaからレース情報を取得しています。");
    const snapshot = await collectRaceSnapshot(buildCollectRaceSnapshotInput(input, raceUrl));
    throwIfAborted(input.signal);
    reportProgress(input, "AIでレース情報を構造化しています。");
    const race = await extractRaceFromSnapshot(buildExtractRaceInput(input, snapshot));
    throwIfAborted(input.signal);
    reportProgress(input, `レース情報を構造化しました: ${race.name} (${race.id})`);
    const raceWithWeather = await attachWeather(race, weatherProvider, input.onProgress);
    throwIfAborted(input.signal);

    // race.json更新後に古いprediction/QAが残る不整合を避けるため、保存前に既存分析を無効化する。
    reportProgress(input, "既存の予想結果を無効化しています。");
    await dependencies.runRepository.invalidateAnalysis(raceWithWeather.id);
    reportProgress(input, "race.json を保存しています。");
    await dependencies.runRepository.saveRace(raceWithWeather);

    reportProgress(input, "予想方針を読み込んでいます。");
    const policy = await dependencies.policyRepository.readPredictionPolicy();
    reportProgress(input, "Codexで予想分析を実行しています。");
    const prediction = await analyzeRace(buildAnalyzeRaceInput(input, raceWithWeather, policy));
    reportProgress(input, "prediction.json を保存しています。");
    await dependencies.runRepository.savePrediction(prediction);

    return { raceId: raceWithWeather.id };
  };
};

/** WebフォームのURLを検証し、Codexやブラウザ操作に渡すURL文字列へ正規化する。 */
const normalizeNetkeibaRaceUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("netKeiba のレースURLを入力してください。");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("URLの形式が正しくありません。");
  }

  if (!["http:", "https:"].includes(url.protocol) || !isNetkeibaHostname(url.hostname)) {
    throw new Error("netKeiba のレースURLを入力してください。");
  }
  if (!url.searchParams.has("race_id")) {
    throw new Error("race_id を含む netKeiba のレースURLを入力してください。");
  }

  return url.toString();
};

/** URL hostname が netKeiba 本体またはサブドメインかどうかを境界つきで判定する。 */
const isNetkeibaHostname = (hostname: string): boolean => {
  const normalizedHostname = hostname.toLowerCase();

  return normalizedHostname === "netkeiba.com" || normalizedHostname.endsWith(".netkeiba.com");
};

/** Web入力から netKeiba snapshot 取得入力を作る。 */
const buildCollectRaceSnapshotInput = (
  input: PredictRaceUseCaseInput,
  raceUrl: string
): CollectRaceSnapshotInput => {
  const collectInput: CollectRaceSnapshotInput = {
    raceUrl,
    headless: true
  };

  if (input.onProgress !== undefined) {
    collectInput.onProgress = input.onProgress;
  }
  if (input.minDelayMs !== undefined) {
    collectInput.minDelayMs = input.minDelayMs;
  }
  if (input.horseDetailLimit !== undefined) {
    collectInput.horseDetailLimit = input.horseDetailLimit;
  }
  if (input.signal !== undefined) {
    collectInput.signal = input.signal;
  }

  return collectInput;
};

/** Web入力とsnapshotからRace構造化入力を作る。 */
const buildExtractRaceInput = (
  input: PredictRaceUseCaseInput,
  snapshot: RaceSourceSnapshot
): ExtractRaceFromSnapshotInput => {
  const extractInput: ExtractRaceFromSnapshotInput = {
    snapshot,
    timeoutMs: input.extractTimeoutMs ?? defaultExtractTimeoutMs
  };
  if (input.model !== undefined) {
    extractInput.model = input.model;
  }
  if (input.signal !== undefined) {
    extractInput.signal = input.signal;
  }

  return extractInput;
};

/** Raceに天気情報を付与し、天気取得失敗時はRaceだけで保存を継続する。 */
const attachWeather = async (
  race: Race,
  weatherProvider: WeatherProvider,
  onProgress: ((message: string) => void) | undefined
): Promise<Race> => {
  onProgress?.("Open-Meteoから天気情報を取得しています。");
  try {
    const weather = await weatherProvider.getWeather({
      racecourse: race.racecourse,
      raceStartTime: race.startTime
    });
    onProgress?.("天気情報を取得しました。");

    return parseRace({ ...race, weather });
  } catch (error) {
    // 天気は補助情報なので、未対応競馬場や一時的な取得失敗ではレース解析全体を止めない。
    onProgress?.(`天気情報を保存しませんでした: ${readErrorMessage(error)}`);
    return race;
  }
};

/** Web入力、Race、予想方針からAI分析入力を作る。 */
const buildAnalyzeRaceInput = (
  input: PredictRaceUseCaseInput,
  race: Race,
  policy: AnalyzeRaceInput["policy"]
): AnalyzeRaceInput => {
  const analyzeInput: AnalyzeRaceInput = {
    race,
    policy,
    timeoutMs: input.analysisTimeoutMs ?? defaultAnalysisTimeoutMs
  };
  if (input.model !== undefined) {
    analyzeInput.model = input.model;
  }
  if (input.signal !== undefined) {
    analyzeInput.signal = input.signal;
  }

  return analyzeInput;
};

/** 呼び出し元が進捗表示を要求している場合だけメッセージを渡す。 */
const reportProgress = (input: PredictRaceUseCaseInput, message: string): void => {
  input.onProgress?.(message);
};

/** unknown の例外値から進捗表示用メッセージを取り出す。 */
const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return String(error);
};

/** 呼び出し元から中断されている場合は、次の外部I/Oへ進む前に停止する。 */
const throwIfAborted = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted !== true) {
    return;
  }

  throw new Error("レース解析ジョブを中止しました。");
};
