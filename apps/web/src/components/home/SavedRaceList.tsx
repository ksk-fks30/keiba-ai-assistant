import { ArrowRight } from "lucide-react";
import { useState } from "react";
import {
  createSavedRaceListView,
  type SavedRaceRunView
} from "@keiba-ai-assistant/web/components/home/saved-race-list-view";
import { ButtonLink } from "@keiba-ai-assistant/web/components/ui/Button";
import { Chip } from "@keiba-ai-assistant/web/components/ui/Chip";
import { Select } from "@keiba-ai-assistant/web/components/ui/Select";
import type { HomePageProps } from "@keiba-ai-assistant/web/server/usecases/show-home";

/** トップ画面に表示する保存済みrunの一覧。 */
export const SavedRaceList = ({ runs }: { runs: HomePageProps["runs"] }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const view = createSavedRaceListView({ runs, selectedDate });

  return (
    <section className="rounded-panel border border-app-border bg-app-surface shadow-sm">
      <div className="border-b border-app-border-soft px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-app-subtle">runs</p>
            <h2 className="mt-1 text-xl font-bold text-app-text">保存済みレース</h2>
          </div>
          <span className="text-sm font-semibold text-app-subtle">
            {view.visibleCount}/{view.totalCount}件
          </span>
        </div>
        {view.dateOptions.length === 0 ? null : (
          <Select
            className="mt-4 max-w-56"
            label="開催日"
            onChange={(event) => {
              setSelectedDate(event.currentTarget.value);
            }}
            value={view.selectedDate ?? ""}
          >
            {view.dateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        )}
      </div>
      {runs.length === 0 ? (
        <div className="px-5 py-10">
          <p className="text-sm font-semibold text-app-text">保存済みレースはまだありません</p>
        </div>
      ) : view.visibleRuns.length === 0 ? (
        <div className="px-5 py-10">
          <p className="text-sm font-semibold text-app-text">
            選択した開催日の保存済みレースはありません
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-app-border-soft">
          {view.visibleRuns.map((run) => (
            <li key={run.run.raceId}>
              <SavedRunListItem run={run} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

/** 保存済みrunを1行の一覧項目として表示する。 */
const SavedRunListItem = ({ run }: { run: SavedRaceRunView }) => {
  const savedRun = run.run;
  const race = savedRun.race;
  const raceHref = `/races/${encodeURIComponent(savedRun.raceId)}`;

  return (
    <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {race === null ? (
            <p className="truncate text-base font-bold text-app-text">{run.title}</p>
          ) : (
            <a
              className="truncate text-base font-bold text-app-text transition hover:text-turf focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turf"
              href={raceHref}
            >
              {run.title}
            </a>
          )}
          <RunStatusLabel hasPrediction={savedRun.hasPrediction} />
          <ReflectionStatusLabel hasReflection={savedRun.hasReflection} />
          {savedRun.hasQa ? <Chip variant="info">Q&A</Chip> : null}
        </div>
        <p className="mt-1 text-sm text-app-subtle">{run.summaryLabel}</p>
        <p className="mt-1 text-xs font-medium text-app-subtle">
          更新 {formatUpdatedAt(savedRun.updatedAt)}
        </p>
      </div>
      {race === null ? (
        <span className="text-sm font-semibold text-app-subtle">表示不可</span>
      ) : (
        <ButtonLink className="shrink-0" href={raceHref} variant="secondary" weight="bold">
          詳細
          <ArrowRight aria-hidden="true" size={16} />
        </ButtonLink>
      )}
    </div>
  );
};

/** 保存済みrunの分析状態を短いラベルで表示する。 */
const RunStatusLabel = ({ hasPrediction }: { hasPrediction: boolean }) => {
  return (
    <Chip variant={hasPrediction ? "success" : "neutral"}>
      {hasPrediction ? "分析済み" : "未分析"}
    </Chip>
  );
};

/** 保存済みrunの振り返り済み状態を短いラベルで表示する。 */
const ReflectionStatusLabel = ({ hasReflection }: { hasReflection: boolean }) => {
  if (!hasReflection) {
    return null;
  }

  return <Chip variant="success">振り返り済み</Chip>;
};

/** ISO日時文字列を YY/mm/dd HH:mm 形式へ変換する。 */
const formatUpdatedAt = (value: string): string => {
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
