import type { HomePageProps } from "@keiba-ai-assistant/web/server/usecases/show-home";

type SavedRaceRun = HomePageProps["runs"][number];
type SavedRace = NonNullable<SavedRaceRun["race"]>;

/** 保存済みレース一覧を表示するために整形した1行分の情報。 */
export interface SavedRaceRunView {
  /** 元の保存済みrun。 */
  run: SavedRaceRun;
  /** 一覧に出すタイトル。 */
  title: string;
  /** 一覧に出すレース条件サマリ。 */
  summaryLabel: string;
  /** 開催日フィルタ用の日付キー。日付不明の場合はnull。 */
  raceDateKey: string | null;
}

/** 保存済みレース一覧の日付フィルタ選択肢。 */
export interface SavedRaceDateOption {
  /** YYYY-MM-DD形式の日付キー。 */
  value: string;
  /** 画面表示用の日付ラベル。 */
  label: string;
}

/** 保存済みレース一覧の表示状態。 */
export interface SavedRaceListView {
  /** 日付フィルタの選択肢。 */
  dateOptions: SavedRaceDateOption[];
  /** 現在有効な日付フィルタ。日付候補がない場合はnull。 */
  selectedDate: string | null;
  /** フィルタ適用後に表示するrun一覧。 */
  visibleRuns: SavedRaceRunView[];
  /** 全run件数。 */
  totalCount: number;
  /** 表示中run件数。 */
  visibleCount: number;
}

/** 保存済みレース一覧の表示状態を作る入力。 */
export interface CreateSavedRaceListViewInput {
  /** サーバーから受け取った保存済みrun一覧。 */
  runs: SavedRaceRun[];
  /** ユーザーが選択中の日付キー。 */
  selectedDate: string | null;
  /** 今日判定に使う現在日時。テストで固定する。 */
  now?: Date | undefined;
}

const displayTimeZone = "Asia/Tokyo";

const dateKeyFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: displayTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: displayTimeZone,
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

/** 保存済みrun一覧から、日付フィルタと表示行を組み立てる。 */
export const createSavedRaceListView = ({
  now = new Date(),
  runs,
  selectedDate
}: CreateSavedRaceListViewInput): SavedRaceListView => {
  const runViews = runs.map(buildSavedRaceRunView);
  const dateOptions = buildDateOptions(runViews);
  const activeDate = selectActiveDate(
    dateOptions.map((option) => option.value),
    selectedDate,
    readDateKey(now)
  );
  const visibleRuns =
    activeDate === null ? runViews : runViews.filter((run) => run.raceDateKey === activeDate);

  return {
    dateOptions,
    selectedDate: activeDate,
    visibleRuns,
    totalCount: runs.length,
    visibleCount: visibleRuns.length
  };
};

/** 保存済みrunを一覧表示用の1行へ変換する。 */
const buildSavedRaceRunView = (run: SavedRaceRun): SavedRaceRunView => {
  return {
    run,
    title: run.race?.name ?? run.raceId,
    summaryLabel: run.race === null ? "race.json 未保存" : formatRaceSummary(run.race),
    raceDateKey: readRaceDateKey(run)
  };
};

/** 一覧に出すレース条件サマリを組み立てる。 */
const formatRaceSummary = (race: SavedRace): string => {
  return [
    race.racecourse,
    formatRaceNumber(race.id),
    `${formatSurface(race.surface)} ${race.distanceMeters}m`,
    formatStartTime(race.startTime)
  ]
    .filter((value): value is string => value !== undefined && value.length > 0)
    .join(" ・ ");
};

/** netKeiba race_id 末尾2桁からレース番号を12R形式で表示する。 */
const formatRaceNumber = (raceId: string): string | undefined => {
  if (!/^\d{12}$/.test(raceId)) {
    return undefined;
  }

  const raceNumber = Number.parseInt(raceId.slice(-2), 10);
  if (raceNumber <= 0) {
    return undefined;
  }

  return `${raceNumber}R`;
};

/** 開催日時を一覧表示用のラベル付き文字列へ変換する。 */
const formatStartTime = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return `発走 ${formatDateTime(value)}`;
};

/** Race surface を画面表示ラベルへ変換する。 */
const formatSurface = (surface: SavedRace["surface"]): string => {
  const labels = {
    turf: "芝",
    dirt: "ダート",
    jump: "障害",
    unknown: "不明"
  } as const;

  return labels[surface];
};

/** ISO日時文字列を YY/mm/dd HH:mm 形式へ変換する。 */
const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const parts = readDatePartValues(dateTimeFormatter, date);
  const { year, month, day, hour, minute } = parts;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    return value;
  }

  return `${year}/${month}/${day} ${hour}:${minute}`;
};

/** runの開催日を日付フィルタ用キーへ変換する。 */
const readRaceDateKey = (run: SavedRaceRun): string | null => {
  if (run.race?.startTime === undefined) {
    return null;
  }

  return readDateKey(new Date(run.race.startTime));
};

/** DateをAsia/Tokyo基準のYYYY-MM-DDキーへ変換する。 */
const readDateKey = (date: Date): string | null => {
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = readDatePartValues(dateKeyFormatter, date);
  const { year, month, day } = parts;
  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }

  return `${year}-${month}-${day}`;
};

/** 日付選択肢を、保存済みrunに存在する開催日だけで作る。 */
const buildDateOptions = (runs: SavedRaceRunView[]): SavedRaceDateOption[] => {
  const keys = new Set<string>();
  for (const run of runs) {
    if (run.raceDateKey !== null) {
      keys.add(run.raceDateKey);
    }
  }

  return [...keys].sort().map((value) => ({
    value,
    label: formatDateOptionLabel(value)
  }));
};

/** 選択中の日付、または今日以降で最も近い日付を返す。 */
const selectActiveDate = (
  dateKeys: string[],
  selectedDate: string | null,
  todayKey: string | null
): string | null => {
  if (dateKeys.length === 0) {
    return null;
  }
  if (selectedDate !== null && dateKeys.includes(selectedDate)) {
    return selectedDate;
  }
  if (todayKey !== null) {
    const nearestFutureDate = dateKeys.find((dateKey) => dateKey >= todayKey);
    if (nearestFutureDate !== undefined) {
      return nearestFutureDate;
    }
  }

  return dateKeys.at(-1) ?? null;
};

/** YYYY-MM-DDキーをセレクト表示用ラベルへ変換する。 */
const formatDateOptionLabel = (dateKey: string): string => {
  return dateKey.replaceAll("-", "/");
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
