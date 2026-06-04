import type {
  RaceDashboardView,
  RaceMetricView,
  WeatherDashboardView
} from "@keiba-ai-assistant/web/components/race/use-race-dashboard-view";

/** race概要カードのprops。 */
interface RaceSummaryProps {
  /** ダッシュボード表示用に整形済みのレース情報。 */
  race: RaceDashboardView;
}

/** race.json 由来のレース条件と天気をダッシュボード上部に表示する。 */
export const RaceSummary = ({ race }: RaceSummaryProps) => {
  return (
    <section className="rounded-panel border border-app-border bg-app-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-app-subtle">{race.id}</p>
          <h1 className="mt-2 text-2xl font-bold leading-tight text-app-text">{race.name}</h1>
          <p className="mt-2 text-sm text-app-subtle">
            {race.racecourse} / {race.surfaceLabel} {race.distanceLabel}
          </p>
          <WeatherLine weather={race.weather} />
        </div>
        <a
          className="rounded-md border border-app-border px-3 py-2 text-sm font-medium text-turf hover:bg-turf-soft"
          href={race.sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          取得元
        </a>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {race.conditionMetrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>
    </section>
  );
};

/** レース条件の1項目を表示する小カード。 */
const MetricCard = ({ metric }: { metric: RaceMetricView }) => {
  return (
    <div className="rounded-md border border-app-border bg-app-muted px-3 py-3">
      <dt className="text-xs font-medium text-app-subtle">{metric.label}</dt>
      <dd className="mt-1 text-sm font-semibold text-app-text">{metric.value}</dd>
    </div>
  );
};

/** タイトル下に天気情報を1行で表示する。 */
const WeatherLine = ({ weather }: { weather: WeatherDashboardView }) => {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <WeatherLineItem label="天気" value={weather.conditionLabel} />
      <WeatherLineItem label="気温" value={weather.temperatureLabel} />
      <WeatherLineItem label="降水" value={weather.precipitationLabel} />
      <WeatherLineItem label="風" value={weather.windLabel} />
      <WeatherLineItem label="基準" value={weather.observedAtLabel} />
      <span className="inline-flex items-baseline gap-1">
        <span className="text-xs font-medium text-app-subtle">source:</span>
        {weather.sourceUrl === undefined ? (
          <span className="font-semibold text-app-text">{weather.sourceLabel}</span>
        ) : (
          <a
            className="font-semibold text-turf underline-offset-2 hover:underline"
            href={weather.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            {weather.sourceLabel}
          </a>
        )}
      </span>
    </p>
  );
};

/** 天気情報1項目のラベルと値を見分けやすく表示する。 */
const WeatherLineItem = ({ label, value }: { label: string; value: string }) => {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-xs font-medium text-app-subtle">{label}:</span>
      <span className="font-semibold text-app-text">{value}</span>
    </span>
  );
};
