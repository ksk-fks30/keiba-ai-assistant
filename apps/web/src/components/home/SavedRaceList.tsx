import { ArrowRight } from "lucide-react";
import type { HomePageProps } from "@keiba-ai-assistant/web/server/usecases/show-home";

/** トップ画面に表示する保存済みrunの一覧。 */
export const SavedRaceList = ({ runs }: { runs: HomePageProps["runs"] }) => {
  return (
    <section className="rounded-panel border border-app-border bg-app-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-app-border-soft px-5 py-4">
        <div>
          <p className="text-xs font-semibold text-app-subtle">runs</p>
          <h2 className="mt-1 text-xl font-bold text-app-text">保存済みレース</h2>
        </div>
        <span className="text-sm font-semibold text-app-subtle">{runs.length}件</span>
      </div>
      {runs.length === 0 ? (
        <div className="px-5 py-10">
          <p className="text-sm font-semibold text-app-text">保存済みレースはまだありません</p>
        </div>
      ) : (
        <ol className="divide-y divide-app-border-soft">
          {runs.map((run) => (
            <li key={run.raceId}>
              <SavedRunListItem run={run} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

/** 保存済みrunを1行の一覧項目として表示する。 */
const SavedRunListItem = ({ run }: { run: HomePageProps["runs"][number] }) => {
  const race = run.race;

  return (
    <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-base font-bold text-app-text">{race?.name ?? run.raceId}</p>
          <RunStatusLabel hasPrediction={run.hasPrediction} />
          {run.hasQa ? (
            <span className="rounded-md bg-info-soft px-2 py-0.5 text-xs font-bold text-info">
              Q&A
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-app-subtle">
          {race === null ? "race.json 未保存" : formatRaceSummary(race)}
        </p>
        <p className="mt-1 text-xs font-medium text-app-subtle">
          更新 {formatDateTime(run.updatedAt)}
        </p>
      </div>
      {race === null ? (
        <span className="text-sm font-semibold text-app-subtle">表示不可</span>
      ) : (
        <a
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-app-border px-3 py-2 text-sm font-bold text-turf transition hover:bg-turf-soft"
          href={`/races/${encodeURIComponent(run.raceId)}`}
        >
          詳細
          <ArrowRight aria-hidden="true" size={16} />
        </a>
      )}
    </div>
  );
};

/** 保存済みrunの分析状態を短いラベルで表示する。 */
const RunStatusLabel = ({ hasPrediction }: { hasPrediction: boolean }) => {
  return (
    <span
      className={
        hasPrediction
          ? "rounded-md bg-turf-soft px-2 py-0.5 text-xs font-bold text-turf"
          : "rounded-md bg-app-muted px-2 py-0.5 text-xs font-bold text-app-subtle"
      }
    >
      {hasPrediction ? "分析済み" : "未分析"}
    </span>
  );
};

/** Race domain model から一覧に出す短いレース概要を作る。 */
const formatRaceSummary = (race: NonNullable<HomePageProps["runs"][number]["race"]>): string => {
  return [
    race.racecourse,
    `${formatSurface(race.surface)} ${race.distanceMeters}m`,
    formatStartTime(race.startTime)
  ]
    .filter((value): value is string => value !== undefined && value.length > 0)
    .join(" ・ ");
};

/** 開催日時を一覧表示用のラベル付き文字列へ変換する。 */
const formatStartTime = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return `発走 ${formatDateTime(value)}`;
};

/** Race surface を画面表示ラベルへ変換する。 */
const formatSurface = (
  surface: NonNullable<HomePageProps["runs"][number]["race"]>["surface"]
): string => {
  const labels = {
    turf: "芝",
    dirt: "ダート",
    jump: "障害",
    unknown: "不明"
  } as const;

  return labels[surface];
};

/** ISO日時文字列を YY/mm/dd HH:mm 形式へ変換する。 */
const formatDateTime = (value: string | undefined): string => {
  if (value === undefined) {
    return "未取得";
  }

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
