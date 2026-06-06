import type {
  Horse,
  PastPerformance,
  Race,
  RaceSurface,
  Weather
} from "@keiba-ai-assistant/models";

/** ダッシュボード表示用に整形したレース情報。 */
export interface RaceDashboardView {
  /** レースID。 */
  id: string;
  /** レース名。 */
  name: string;
  /** 取得元URL。 */
  sourceUrl: string;
  /** 競馬場名。 */
  racecourse: string;
  /** 発走時刻の表示文字列。 */
  startTimeLabel: string;
  /** 馬場種別の表示文字列。 */
  surfaceLabel: string;
  /** 距離の表示文字列。 */
  distanceLabel: string;
  /** 回り方向やコースレイアウトの表示文字列。 */
  directionLabel: string;
  /** 馬場状態の表示文字列。 */
  trackConditionLabel: string;
  /** 取得日時の表示文字列。 */
  collectedAtLabel: string;
  /** レース時点の天気情報。 */
  weather: WeatherDashboardView;
  /** レース条件をまとめた指標。 */
  conditionMetrics: RaceMetricView[];
  /** 出走馬一覧。 */
  horses: HorseDashboardView[];
}

/** ラベルと値で表示するレース指標。 */
export interface RaceMetricView {
  /** 指標名。 */
  label: string;
  /** 指標値。 */
  value: string;
}

/** ダッシュボード表示用に整形した天気情報。 */
export interface WeatherDashboardView {
  /** 天候の表示文字列。 */
  conditionLabel: string;
  /** 気温の表示文字列。 */
  temperatureLabel: string;
  /** 降水確率の表示文字列。 */
  precipitationLabel: string;
  /** 風の表示文字列。 */
  windLabel: string;
  /** 観測または予報日時の表示文字列。 */
  observedAtLabel: string;
  /** 天気情報の取得元表示。 */
  sourceLabel: string;
  /** 天気情報の取得元URL。URLとして扱えない場合はundefined。 */
  sourceUrl: string | undefined;
}

/** ダッシュボード表示用に整形した出走馬情報。 */
export interface HorseDashboardView {
  /** 馬ID。 */
  id: string;
  /** 枠番の表示文字列。 */
  gateNumberLabel: string;
  /** 馬番の表示文字列。 */
  horseNumberLabel: string;
  /** 馬名。 */
  name: string;
  /** 性齢の表示文字列。 */
  sexAgeLabel: string;
  /** 騎手名の表示文字列。 */
  jockeyLabel: string;
  /** 調教師名の表示文字列。 */
  trainerLabel: string;
  /** 馬体重の表示文字列。 */
  bodyWeightLabel: string;
  /** 単勝オッズの表示文字列。 */
  oddsLabel: string;
  /** 人気順。未取得の場合はundefined。 */
  popularity: number | undefined;
  /** 人気順の表示文字列。 */
  popularityLabel: string;
  /** 血統の表示文字列。 */
  pedigreeLabel: string;
  /** 血統系統の表示項目。 */
  pedigreeLineageItems: RaceMetricView[];
  /** 予想判断に使う血統補足文。 */
  pedigreeNotes: string[];
  /** 直近成績。 */
  pastPerformances: PastPerformanceDashboardView[];
}

/** ダッシュボード表示用に整形した過去走情報。 */
export interface PastPerformanceDashboardView {
  /** レース日の表示文字列。 */
  dateLabel: string;
  /** 過去走のレース名。 */
  raceName: string;
  /** レース条件の表示文字列。 */
  conditionLabel: string;
  /** 着順の表示文字列。 */
  finishPositionLabel: string;
  /** 騎手名の表示文字列。 */
  jockeyLabel: string;
  /** 斤量の表示文字列。 */
  weightCarriedLabel: string;
  /** 馬体重の表示文字列。 */
  bodyWeightLabel: string;
  /** 人気とオッズの表示文字列。 */
  marketLabel: string;
  /** 脚質や通過順の表示文字列。 */
  runningStyleLabel: string;
  /** 補足メモの表示文字列。 */
  noteLabel: string;
}

const surfaceLabels: Record<RaceSurface, string> = {
  turf: "芝",
  dirt: "ダート",
  jump: "障害",
  unknown: "不明"
};

const displayTimeZone = "Asia/Tokyo";

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: displayTimeZone,
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: displayTimeZone,
  year: "2-digit",
  month: "2-digit",
  day: "2-digit"
});

/** React view側でRace domain modelをダッシュボード表示用viewへ変換する。 */
export const useRaceDashboardView = (race: Race | null): RaceDashboardView | null => {
  if (race === null) {
    return null;
  }

  return buildRaceDashboardView(race);
};

/** Race domain model をダッシュボード表示用viewへ変換する。 */
const buildRaceDashboardView = (race: Race): RaceDashboardView => {
  const surfaceLabel = formatSurface(race.surface);
  const distanceLabel = `${race.distanceMeters}m`;
  const directionLabel = race.direction ?? "未取得";
  const trackConditionLabel = race.trackCondition ?? "未取得";

  return {
    id: race.id,
    name: race.name,
    sourceUrl: race.sourceUrl,
    racecourse: race.racecourse,
    startTimeLabel: formatDateTime(race.startTime),
    surfaceLabel,
    distanceLabel,
    directionLabel,
    trackConditionLabel,
    collectedAtLabel: formatDateTime(race.collectedAt),
    weather: buildWeatherDashboardView(race.weather),
    conditionMetrics: [
      { label: "競馬場", value: race.racecourse },
      { label: "コース", value: `${surfaceLabel} ${distanceLabel}` },
      { label: "回り", value: directionLabel },
      { label: "馬場", value: trackConditionLabel },
      { label: "発走", value: formatDateTime(race.startTime) },
      { label: "取得", value: formatDateTime(race.collectedAt) }
    ],
    horses: race.horses.map(buildHorseDashboardView)
  };
};

/** Weather domain model をダッシュボード表示用viewへ変換する。 */
const buildWeatherDashboardView = (weather: Weather | undefined): WeatherDashboardView => {
  return {
    conditionLabel: weather?.condition ?? "未取得",
    temperatureLabel:
      weather?.temperatureCelsius === undefined ? "未取得" : `${weather.temperatureCelsius}℃`,
    precipitationLabel:
      weather?.precipitationProbability === undefined
        ? "未取得"
        : `${weather.precipitationProbability}%`,
    windLabel: weather?.wind ?? "未取得",
    observedAtLabel: formatDateTime(weather?.observedAt),
    sourceLabel: formatWeatherSourceLabel(weather?.source),
    sourceUrl: parseUrlString(weather?.source)
  };
};

/** 天気sourceを画面表示用の短いラベルへ変換する。 */
const formatWeatherSourceLabel = (source: string | undefined): string => {
  const sourceUrl = parseUrlString(source);
  if (sourceUrl === undefined) {
    return source ?? "未取得";
  }

  const hostname = new URL(sourceUrl).hostname;
  return hostname.includes("open-meteo.com") ? "Open-Meteo" : hostname;
};

/** URLとして扱える文字列だけを返す。 */
const parseUrlString = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
};

/** Horse domain model をダッシュボード表示用viewへ変換する。 */
const buildHorseDashboardView = (horse: Horse): HorseDashboardView => {
  return {
    id: horse.id,
    gateNumberLabel: formatNumber(horse.gateNumber),
    horseNumberLabel: formatNumber(horse.horseNumber),
    name: horse.name,
    sexAgeLabel: formatSexAge(horse),
    jockeyLabel: horse.jockey ?? "未取得",
    trainerLabel: horse.trainer ?? "未取得",
    bodyWeightLabel: formatBodyWeight(horse.bodyWeightKg, horse.bodyWeightDiffKg),
    oddsLabel: horse.odds === undefined ? "未取得" : horse.odds.toFixed(1),
    popularity: horse.popularity,
    popularityLabel: horse.popularity === undefined ? "未取得" : horse.popularity.toString(),
    pedigreeLabel: formatPedigree(horse),
    pedigreeLineageItems: buildPedigreeLineageItems(horse),
    pedigreeNotes: horse.pedigree.familyNotes,
    pastPerformances: horse.pastPerformances.map(buildPastPerformanceDashboardView)
  };
};

/** PastPerformance domain model をダッシュボード表示用viewへ変換する。 */
const buildPastPerformanceDashboardView = (
  performance: PastPerformance
): PastPerformanceDashboardView => {
  return {
    dateLabel: formatDate(performance.date),
    raceName: performance.raceName,
    conditionLabel: formatPastPerformanceCondition(performance),
    finishPositionLabel:
      performance.finishPosition === undefined ? "未取得" : `${performance.finishPosition}着`,
    jockeyLabel: performance.jockey ?? "未取得",
    weightCarriedLabel:
      performance.weightCarriedKg === undefined ? "未取得" : `${performance.weightCarriedKg}kg`,
    bodyWeightLabel:
      performance.bodyWeightKg === undefined ? "未取得" : `${performance.bodyWeightKg}kg`,
    marketLabel: formatPastPerformanceMarket(performance),
    runningStyleLabel: performance.runningStyle ?? "未取得",
    noteLabel: performance.note ?? "未取得"
  };
};

/** 馬場種別を日本語表示へ変換する。 */
const formatSurface = (surface: RaceSurface): string => {
  return surfaceLabels[surface];
};

/** 日時文字列を YY/mm/dd HH:mm の表示へ変換する。 */
const formatDateTime = (value: string | undefined): string => {
  if (value === undefined) {
    return "未取得";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatDateTimeParts(date) ?? value;
};

/** 日付文字列を YY/mm/dd の表示へ変換する。 */
const formatDate = (value: string): string => {
  const dateOnlyLabel = formatDateOnlyText(value);
  if (dateOnlyLabel !== undefined) {
    return dateOnlyLabel;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatDateParts(date) ?? value;
};

/** Date を YY/mm/dd HH:mm の表示へ変換する。 */
const formatDateTimeParts = (date: Date): string | undefined => {
  const parts = readDatePartValues(dateTimeFormatter, date);
  const { year, month, day, hour, minute } = parts;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    return undefined;
  }

  return `${year}/${month}/${day} ${hour}:${minute}`;
};

/** Date を YY/mm/dd の表示へ変換する。 */
const formatDateParts = (date: Date): string | undefined => {
  const parts = readDatePartValues(dateFormatter, date);
  const { year, month, day } = parts;
  if (year === undefined || month === undefined || day === undefined) {
    return undefined;
  }

  return `${year}/${month}/${day}`;
};

/** YYYY-MM-DD 形式の日付文字列をタイムゾーン変換せず YY/mm/dd に変換する。 */
const formatDateOnlyText = (value: string): string | undefined => {
  const [year, month, day, ...rest] = value.split("-");
  if (
    rest.length > 0 ||
    year === undefined ||
    month === undefined ||
    day === undefined ||
    !/^\d{4}$/.test(year) ||
    !/^\d{2}$/.test(month) ||
    !/^\d{2}$/.test(day)
  ) {
    return undefined;
  }

  return `${year.slice(-2)}/${month}/${day}`;
};

/** Intl.DateTimeFormat の parts を固定キーで参照できる形に変換する。 */
const readDatePartValues = (formatter: Intl.DateTimeFormat, date: Date): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return values;
};

/** 数値を未取得表示つきの文字列へ変換する。 */
const formatNumber = (value: number | undefined): string => {
  return value === undefined ? "-" : value.toString();
};

/** 性齢を1つの表示文字列へまとめる。 */
const formatSexAge = (horse: Horse): string => {
  const sex = horse.sex ?? "";
  const age = horse.age === undefined ? "" : `${horse.age}歳`;
  const label = `${sex}${age}`;

  return label.length === 0 ? "未取得" : label;
};

/** 馬体重と増減を1つの表示文字列へまとめる。 */
const formatBodyWeight = (
  bodyWeightKg: number | undefined,
  bodyWeightDiffKg: number | undefined
): string => {
  if (bodyWeightKg === undefined) {
    return "未発表";
  }
  if (bodyWeightDiffKg === undefined) {
    return `${bodyWeightKg}kg`;
  }

  return `${bodyWeightKg}kg (${formatSignedNumber(bodyWeightDiffKg)})`;
};

/** 符号付き数値を表示用に整える。 */
const formatSignedNumber = (value: number): string => {
  if (value > 0) {
    return `+${value}`;
  }
  if (value === 0) {
    return "±0";
  }

  return value.toString();
};

/** 血統情報を一覧内で読める1行にまとめる。 */
const formatPedigree = (horse: Horse): string => {
  const parts = [
    horse.pedigree.sire === undefined ? undefined : `父 ${horse.pedigree.sire}`,
    horse.pedigree.dam === undefined ? undefined : `母 ${horse.pedigree.dam}`,
    horse.pedigree.damSire === undefined ? undefined : `母父 ${horse.pedigree.damSire}`
  ].filter(isDefined);

  return parts.length === 0 ? "未取得" : parts.join(" / ");
};

/** 血統ページ由来の系統情報を表示しやすい項目へ変換する。 */
const buildPedigreeLineageItems = (horse: Horse): RaceMetricView[] => {
  return [
    buildLineageItem("父系", horse.pedigree.sireLine),
    buildLineageItem("母父系", horse.pedigree.damSireLine),
    buildLineageItem("牝系", horse.pedigree.femaleFamily)
  ].filter(isDefined);
};

/** 空でない系統情報だけを表示項目として返す。 */
const buildLineageItem = (label: string, value: string | undefined): RaceMetricView | undefined => {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  return { label, value };
};

/** 過去走の条件を1つの表示文字列へまとめる。 */
const formatPastPerformanceCondition = (performance: PastPerformance): string => {
  const parts = [
    performance.racecourse,
    formatSurface(performance.surface),
    performance.distanceMeters === undefined ? undefined : `${performance.distanceMeters}m`,
    performance.trackCondition
  ].filter(isDefined);

  return parts.length === 0 ? "未取得" : parts.join(" ");
};

/** 過去走の人気とオッズを1つの表示文字列へまとめる。 */
const formatPastPerformanceMarket = (performance: PastPerformance): string => {
  const parts = [
    performance.popularity === undefined ? undefined : `${performance.popularity}人気`,
    performance.odds === undefined ? undefined : `${performance.odds.toFixed(1)}倍`
  ].filter(isDefined);

  return parts.length === 0 ? "未取得" : parts.join(" / ");
};

/** undefined を配列のfilterで落とすための型ガード。 */
const isDefined = <T>(value: T | undefined): value is T => {
  return value !== undefined;
};
