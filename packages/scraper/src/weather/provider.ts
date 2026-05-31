import { parseWeather, type Weather } from "@keiba-ai-assistant/models";

/** 天気取得対象のレース情報。 */
export interface WeatherProviderInput {
  /** netKeibaやAI抽出で得た競馬場名。 */
  racecourse: string;
  /** 発走予定日時。Asia/Tokyo の ISO 8601 形式を想定する。 */
  raceStartTime?: string | undefined;
}

/** 天気情報を取得する provider。 */
export interface WeatherProvider {
  /** レース場と発走時刻に紐づく天気情報を返す。 */
  getWeather: (input: WeatherProviderInput) => Promise<Weather>;
}

/** Open-Meteo provider のHTTP差し替え用レスポンス。 */
export interface OpenMeteoHttpResponse {
  /** HTTP 2xx かどうか。 */
  ok: boolean;
  /** HTTPステータスコード。 */
  status: number;
  /** JSONレスポンス本文を返す。 */
  json: () => Promise<unknown>;
}

/** Open-Meteo provider のHTTP差し替え関数。 */
export type OpenMeteoFetch = (url: string) => Promise<OpenMeteoHttpResponse>;

/** Open-Meteo provider の設定。 */
export interface OpenMeteoWeatherProviderOptions {
  /** テストや将来のキャッシュ層で差し替えるHTTP関数。 */
  fetch?: OpenMeteoFetch | undefined;
}

/** JRA競馬場のOpen-Meteo問い合わせ用座標。 */
interface RacecourseLocation {
  /** 競馬場名の短縮表記。 */
  name: string;
  /** WGS84の緯度。 */
  latitude: number;
  /** WGS84の経度。 */
  longitude: number;
}

/** Open-Meteo hourly検索に使う発走日時情報。 */
interface TargetRaceTime {
  /** Open-Meteoのstart_date/end_dateに渡す日付。 */
  date: string;
  /** hourlyの最寄り時刻を選ぶためのUnix epochミリ秒。 */
  timestampMs: number;
}

/** Open-Meteo current weather レスポンスの利用項目。 */
interface OpenMeteoCurrentWeather {
  /** currentデータの有効時刻。 */
  time?: unknown;
  /** 気温。摂氏。 */
  temperature_2m?: unknown;
  /** WMO天気コード。 */
  weather_code?: unknown;
  /** 10m地点の風速。km/h。 */
  wind_speed_10m?: unknown;
  /** 10m地点の風向。度数。 */
  wind_direction_10m?: unknown;
}

/** Open-Meteo hourly weather レスポンスの利用項目。 */
interface OpenMeteoHourlyWeather {
  /** hourlyデータの各有効時刻。 */
  time?: unknown;
  /** hourlyの気温配列。摂氏。 */
  temperature_2m?: unknown;
  /** hourlyの降水確率配列。パーセント単位。 */
  precipitation_probability?: unknown;
  /** hourlyのWMO天気コード配列。 */
  weather_code?: unknown;
  /** hourlyの10m地点風速配列。km/h。 */
  wind_speed_10m?: unknown;
  /** hourlyの10m地点風向配列。度数。 */
  wind_direction_10m?: unknown;
}

/** Open-Meteo Forecast API レスポンスの大枠。 */
interface OpenMeteoForecastResponse {
  /** Open-Meteoが返すエラーフラグ。 */
  error?: unknown;
  /** Open-Meteoが返すエラー理由。 */
  reason?: unknown;
  /** current指定時の天気データ。 */
  current?: unknown;
  /** hourly指定時の天気データ。 */
  hourly?: unknown;
}

const openMeteoForecastEndpoint = "https://api.open-meteo.com/v1/forecast";
const japanTimezone = "Asia/Tokyo";
const japanTimezoneOffset = "+09:00";
const hourlyVariables = [
  "temperature_2m",
  "precipitation_probability",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m"
];
const currentVariables = ["temperature_2m", "weather_code", "wind_speed_10m", "wind_direction_10m"];

const racecourseLocations: RacecourseLocation[] = [
  { name: "札幌", latitude: 43.0097, longitude: 141.4098 },
  { name: "函館", latitude: 41.781, longitude: 140.775 },
  { name: "福島", latitude: 37.7675, longitude: 140.4747 },
  { name: "新潟", latitude: 37.9476, longitude: 139.1906 },
  { name: "東京", latitude: 35.6635, longitude: 139.4851 },
  { name: "中山", latitude: 35.7256, longitude: 139.9594 },
  { name: "中京", latitude: 35.0596, longitude: 136.985 },
  { name: "京都", latitude: 34.9066, longitude: 135.726 },
  { name: "阪神", latitude: 34.7792, longitude: 135.3615 },
  { name: "小倉", latitude: 33.8428, longitude: 130.8749 }
];

/** Open-Meteo Forecast API を使う天気 provider を作る。 */
export const createOpenMeteoWeatherProvider = (
  options: OpenMeteoWeatherProviderOptions = {}
): WeatherProvider => {
  const fetcher = options.fetch ?? fetchOpenMeteo;

  return {
    getWeather: async (input) => {
      const location = findRacecourseLocation(input.racecourse);
      const targetTime = buildTargetRaceTime(input.raceStartTime);
      const url = buildOpenMeteoForecastUrl(location, targetTime);
      const response = await fetcher(url);
      const payload = await readOpenMeteoPayload(response);

      if (targetTime === null) {
        return buildCurrentWeather(payload, url);
      }

      return buildHourlyWeather(payload, targetTime, url);
    }
  };
};

/** 実HTTPでOpen-Meteoへアクセスする。 */
const fetchOpenMeteo = async (url: string): Promise<OpenMeteoHttpResponse> => {
  return fetch(url);
};

/** 競馬場名からJRA競馬場の座標を引く。 */
const findRacecourseLocation = (racecourse: string): RacecourseLocation => {
  const normalized = normalizeRacecourseName(racecourse);
  const location = racecourseLocations.find((candidate) => candidate.name === normalized);

  if (location === undefined) {
    throw new Error(`Open-Meteo の天気取得に未対応の競馬場です: ${racecourse}`);
  }

  return location;
};

/** 競馬場名を座標マップ用の短い名称へ正規化する。 */
const normalizeRacecourseName = (racecourse: string): string => {
  return racecourse.replace(/\s+/g, "").replace(/競馬場$/, "");
};

/** 発走日時文字列をOpen-Meteoの検索日付と時刻比較用timestampへ変換する。 */
const buildTargetRaceTime = (raceStartTime: string | undefined): TargetRaceTime | null => {
  if (raceStartTime === undefined || raceStartTime.trim().length === 0) {
    return null;
  }

  const normalized = normalizeRaceStartTime(raceStartTime);
  const timestampMs = Date.parse(normalized);

  if (Number.isNaN(timestampMs)) {
    throw new Error(`発走予定日時をOpen-Meteo用に解釈できません: ${raceStartTime}`);
  }

  return {
    date: normalized.slice(0, 10),
    timestampMs
  };
};

/** タイムゾーンがないAI抽出値は日本時間として扱う。 */
const normalizeRaceStartTime = (raceStartTime: string): string => {
  const trimmed = raceStartTime.trim();
  const withTime = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00` : trimmed;
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(withTime)
    ? `${withTime}:00`
    : withTime;

  if (hasTimezoneSuffix(withSeconds)) {
    return withSeconds;
  }

  return `${withSeconds}${japanTimezoneOffset}`;
};

/** 日時文字列が明示的なタイムゾーンを持つかどうかを判定する。 */
const hasTimezoneSuffix = (value: string): boolean => {
  return /(Z|[+-]\d{2}:?\d{2})$/.test(value);
};

/** Open-Meteo Forecast API のURLを組み立てる。 */
const buildOpenMeteoForecastUrl = (
  location: RacecourseLocation,
  targetTime: TargetRaceTime | null
): string => {
  const url = new URL(openMeteoForecastEndpoint);
  url.searchParams.set("latitude", location.latitude.toString());
  url.searchParams.set("longitude", location.longitude.toString());
  url.searchParams.set("timezone", japanTimezone);
  url.searchParams.set("temperature_unit", "celsius");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("precipitation_unit", "mm");

  if (targetTime === null) {
    url.searchParams.set("current", currentVariables.join(","));
    return url.toString();
  }

  url.searchParams.set("hourly", hourlyVariables.join(","));
  url.searchParams.set("start_date", targetTime.date);
  url.searchParams.set("end_date", targetTime.date);
  return url.toString();
};

/** HTTPレスポンスを読み、Open-Meteoのエラー形式を通常の例外に変換する。 */
const readOpenMeteoPayload = async (
  response: OpenMeteoHttpResponse
): Promise<OpenMeteoForecastResponse> => {
  const payload = await response.json();

  if (!isOpenMeteoForecastResponse(payload)) {
    throw new Error("Open-Meteo のレスポンス形式を解釈できません。");
  }
  if (!response.ok || payload.error === true) {
    throw new Error(`Open-Meteo の天気取得に失敗しました: ${readOpenMeteoErrorReason(payload)}`);
  }

  return payload;
};

/** Open-Meteo Forecast API の大枠レスポンスかどうかを判定する。 */
const isOpenMeteoForecastResponse = (value: unknown): value is OpenMeteoForecastResponse => {
  return typeof value === "object" && value !== null;
};

/** Open-Meteoエラー本文から表示用の理由を取り出す。 */
const readOpenMeteoErrorReason = (payload: OpenMeteoForecastResponse): string => {
  if (typeof payload.reason === "string" && payload.reason.length > 0) {
    return payload.reason;
  }

  return "reasonなし";
};

/** currentレスポンスからWeatherを作る。 */
const buildCurrentWeather = (payload: OpenMeteoForecastResponse, source: string): Weather => {
  if (!isOpenMeteoCurrentWeather(payload.current)) {
    throw new Error("Open-Meteo の current 天気レスポンスを解釈できません。");
  }

  return parseWeather({
    ...buildOptionalStringProperty("condition", mapWeatherCode(payload.current.weather_code)),
    ...buildOptionalNumberProperty("temperatureCelsius", payload.current.temperature_2m),
    ...buildOptionalStringProperty(
      "wind",
      formatWind(payload.current.wind_speed_10m, payload.current.wind_direction_10m)
    ),
    source,
    ...buildOptionalStringProperty("observedAt", formatOpenMeteoJapanTime(payload.current.time))
  });
};

/** current weather として扱える object かどうかを判定する。 */
const isOpenMeteoCurrentWeather = (value: unknown): value is OpenMeteoCurrentWeather => {
  return typeof value === "object" && value !== null;
};

/** hourlyレスポンスから発走時刻に最も近いWeatherを作る。 */
const buildHourlyWeather = (
  payload: OpenMeteoForecastResponse,
  targetTime: TargetRaceTime,
  source: string
): Weather => {
  if (!isOpenMeteoHourlyWeather(payload.hourly) || !isStringArray(payload.hourly.time)) {
    throw new Error("Open-Meteo の hourly 天気レスポンスを解釈できません。");
  }

  const index = findNearestHourlyIndex(payload.hourly.time, targetTime.timestampMs);

  return parseWeather({
    ...buildOptionalStringProperty(
      "condition",
      mapWeatherCode(readArrayNumber(payload.hourly.weather_code, index))
    ),
    ...buildOptionalNumberProperty(
      "precipitationProbability",
      readArrayNumber(payload.hourly.precipitation_probability, index)
    ),
    ...buildOptionalNumberProperty(
      "temperatureCelsius",
      readArrayNumber(payload.hourly.temperature_2m, index)
    ),
    ...buildOptionalStringProperty(
      "wind",
      formatWind(
        readArrayNumber(payload.hourly.wind_speed_10m, index),
        readArrayNumber(payload.hourly.wind_direction_10m, index)
      )
    ),
    source,
    observedAt: formatOpenMeteoJapanTime(payload.hourly.time[index])
  });
};

/** hourly weather として扱える object かどうかを判定する。 */
const isOpenMeteoHourlyWeather = (value: unknown): value is OpenMeteoHourlyWeather => {
  return typeof value === "object" && value !== null;
};

/** 文字列配列かどうかを判定する。 */
const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
};

/** 発走時刻に最も近い hourly index を返す。 */
const findNearestHourlyIndex = (times: string[], targetTimestampMs: number): number => {
  const indexedTimes = times
    .map((time, index) => ({
      index,
      timestampMs: Date.parse(normalizeOpenMeteoJapanTime(time))
    }))
    .filter((entry) => !Number.isNaN(entry.timestampMs));

  if (indexedTimes.length === 0) {
    throw new Error("Open-Meteo の hourly time を日時として解釈できません。");
  }

  return indexedTimes.reduce((nearest, current) => {
    const nearestDiff = Math.abs(nearest.timestampMs - targetTimestampMs);
    const currentDiff = Math.abs(current.timestampMs - targetTimestampMs);
    return currentDiff < nearestDiff ? current : nearest;
  }).index;
};

/** Open-Meteoの日本時間文字列をDate.parse可能な形式に整える。 */
const normalizeOpenMeteoJapanTime = (value: string): string => {
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;

  if (hasTimezoneSuffix(withSeconds)) {
    return withSeconds;
  }

  return `${withSeconds}${japanTimezoneOffset}`;
};

/** Open-Meteoの日本時間文字列を保存用のISO風表記へ整える。 */
const formatOpenMeteoJapanTime = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  return normalizeOpenMeteoJapanTime(value);
};

/** 配列の指定位置から数値だけを取り出す。 */
const readArrayNumber = (value: unknown, index: number): number | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const item = value[index];
  return typeof item === "number" ? item : undefined;
};

/** 数値なら指定キーのプロパティとして返す。 */
const buildOptionalNumberProperty = <Key extends string>(
  key: Key,
  value: unknown
): Partial<Record<Key, number>> => {
  if (typeof value !== "number") {
    return {};
  }

  return { [key]: value } as Partial<Record<Key, number>>;
};

/** 空文字でない文字列なら指定キーのプロパティとして返す。 */
const buildOptionalStringProperty = <Key extends string>(
  key: Key,
  value: string | undefined
): Partial<Record<Key, string>> => {
  if (value === undefined || value.length === 0) {
    return {};
  }

  return { [key]: value } as Partial<Record<Key, string>>;
};

/** WMO天気コードを日本語の短い天候表記に変換する。 */
const mapWeatherCode = (value: unknown): string | undefined => {
  if (typeof value !== "number") {
    return undefined;
  }

  if (value === 0) {
    return "快晴";
  }
  if (value === 1) {
    return "晴れ";
  }
  if (value === 2) {
    return "一部曇り";
  }
  if (value === 3) {
    return "曇り";
  }
  if ([45, 48].includes(value)) {
    return "霧";
  }
  if ([51, 53, 55, 56, 57].includes(value)) {
    return "霧雨";
  }
  if ([61, 63, 65, 66, 67].includes(value)) {
    return "雨";
  }
  if ([71, 73, 75, 77].includes(value)) {
    return "雪";
  }
  if ([80, 81, 82].includes(value)) {
    return "にわか雨";
  }
  if ([85, 86].includes(value)) {
    return "にわか雪";
  }
  if ([95, 96, 99].includes(value)) {
    return "雷雨";
  }

  return `WMO ${value}`;
};

/** 風向と風速を人間が読める短い表記へ整える。 */
const formatWind = (speed: unknown, direction: unknown): string | undefined => {
  if (typeof speed !== "number" && typeof direction !== "number") {
    return undefined;
  }

  const speedText = typeof speed === "number" ? `${formatNumber(speed)}km/h` : "";
  const directionText = typeof direction === "number" ? formatWindDirection(direction) : "";

  return [directionText, speedText].filter((item) => item.length > 0).join(" ");
};

/** 小数が不要な数値は整数として表示する。 */
const formatNumber = (value: number): string => {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
};

/** 角度の風向を8方位の日本語に変換する。 */
const formatWindDirection = (degree: number): string => {
  const directions = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"];
  const normalized = ((degree % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % directions.length;

  return directions[index] ?? "";
};
