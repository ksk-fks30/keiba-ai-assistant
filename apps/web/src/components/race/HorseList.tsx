import type {
  HorseDashboardView,
  PastPerformanceDashboardView
} from "@keiba-ai-assistant/web/components/race/use-race-dashboard-view";

/** 出走馬一覧のprops。 */
interface HorseListProps {
  /** ダッシュボード表示用に整形済みの出走馬一覧。 */
  horses: HorseDashboardView[];
}

/** race.json に含まれる出走馬、馬体重、オッズ、血統、直近成績を表示する。 */
export const HorseList = ({ horses }: HorseListProps) => {
  return (
    <section className="shrink-0 overflow-hidden rounded-panel border border-app-border bg-app-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-app-border-soft px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-app-text">出走馬</h2>
          <p className="mt-1 text-sm text-app-subtle">{horses.length}頭</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-b border-app-border-soft text-left text-sm">
          <thead className="bg-app-muted text-xs font-semibold text-app-subtle">
            <tr>
              <th className="w-14 px-4 py-3">枠</th>
              <th className="w-14 px-4 py-3">馬番</th>
              <th className="min-w-44 px-4 py-3">馬名</th>
              <th className="px-4 py-3">性齢</th>
              <th className="px-4 py-3">騎手</th>
              <th className="px-4 py-3">馬体重</th>
              <th className="w-16 px-2 py-3 text-center">人気</th>
              <th className="px-4 py-3 pl-8">オッズ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border-soft">
            {horses.map((horse) => (
              <tr key={horse.id} className="align-middle">
                <td className="px-4 py-3 font-semibold text-app-subtle">{horse.gateNumberLabel}</td>
                <td className="px-4 py-3 font-bold text-app-text">{horse.horseNumberLabel}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-app-text">{horse.name}</div>
                  <div className="mt-1 text-xs text-app-subtle">{horse.trainerLabel}</div>
                </td>
                <td className="px-4 py-3 text-app-text">{horse.sexAgeLabel}</td>
                <td className="px-4 py-3 text-app-text">{horse.jockeyLabel}</td>
                <td className="px-4 py-3 text-app-text">{horse.bodyWeightLabel}</td>
                <td
                  className={`w-16 px-2 py-3 text-center ${getPopularityCellColorClass(horse.popularity)}`}
                >
                  <PopularityText label={horse.popularityLabel} />
                </td>
                <td className="px-4 py-3 pl-8 font-semibold text-app-text">{horse.oddsLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 p-5 xl:grid-cols-2">
        {horses.map((horse) => (
          <HorseDetail key={horse.id} horse={horse} />
        ))}
      </div>
    </section>
  );
};

/** 人気順を太字テキストで表示する。 */
const PopularityText = ({ label }: { label: string }) => {
  return <span className="font-bold">{label}</span>;
};

/** 1〜3人気のセル背景を金、銀、銅で表現し、それ以外は控えめに表示する。 */
const getPopularityCellColorClass = (popularity: number | undefined): string => {
  if (popularity === 1) {
    return "bg-yellow-200 text-yellow-950";
  }
  if (popularity === 2) {
    return "bg-zinc-200 text-zinc-950";
  }
  if (popularity === 3) {
    return "bg-orange-200 text-orange-950";
  }

  return "text-app-subtle";
};

/** 各馬の血統メモと直近成績を表示する詳細カード。 */
const HorseDetail = ({ horse }: { horse: HorseDashboardView }) => {
  return (
    <article className="rounded-panel border border-app-border-soft bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-app-subtle">
            {horse.gateNumberLabel}枠 {horse.horseNumberLabel}番
          </p>
          <h3 className="mt-1 text-base font-bold text-app-text">{horse.name}</h3>
        </div>
        <div className="flex flex-col items-end text-right text-xs text-app-subtle">
          <PopularityText label={horse.popularityLabel} />
          <div className="mt-1 font-semibold text-app-text">{horse.oddsLabel}</div>
        </div>
      </div>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <HorseFact label="騎手" value={horse.jockeyLabel} />
        <HorseFact label="調教師" value={horse.trainerLabel} />
        <HorseFact label="馬体重" value={horse.bodyWeightLabel} />
        <HorseFact label="血統" value={horse.pedigreeLabel} wide />
      </dl>
      <PedigreeLineage items={horse.pedigreeLineageItems} />
      <PedigreeNotes notes={horse.pedigreeNotes} />
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="text-app-subtle">
            <tr>
              <th className="py-2 pr-3">日付</th>
              <th className="py-2 pr-3">レース</th>
              <th className="py-2 pr-3">条件</th>
              <th className="py-2 pr-3">着順</th>
              <th className="py-2 pr-3">脚質</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border-soft">
            {horse.pastPerformances.map((performance) => (
              <PastPerformanceRow
                key={`${horse.id}-${performance.dateLabel}-${performance.raceName}`}
                performance={performance}
              />
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
};

/** 血統ページから取得した父系・母父系・牝系を小さなタグとして表示する。 */
const PedigreeLineage = ({ items }: { items: HorseDashboardView["pedigreeLineageItems"] }) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <dl className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className="rounded-md border border-app-border-soft bg-app-muted px-2.5 py-1.5"
        >
          <dt className="text-[11px] font-semibold text-app-subtle">{item.label}</dt>
          <dd className="mt-0.5 text-xs font-semibold text-app-text">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
};

/** 血統上の補足文を、通常の情報枠として表示する。 */
const PedigreeNotes = ({ notes }: { notes: string[] }) => {
  if (notes.length === 0) {
    return null;
  }

  return (
    <section className="mt-3 rounded-md border border-app-border-soft bg-app-muted px-3 py-3">
      <h4 className="text-xs font-semibold text-app-subtle">血統補足</h4>
      <ul className="mt-2 space-y-1.5">
        {notes.map((note) => (
          <li key={note} className="text-xs leading-relaxed text-app-text">
            {note}
          </li>
        ))}
      </ul>
    </section>
  );
};

/** 馬の補足情報を表示する小さな定義項目。 */
const HorseFact = ({
  label,
  value,
  wide = false
}: {
  label: string;
  value: string;
  wide?: boolean;
}) => {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-app-subtle">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-app-text">{value}</dd>
    </div>
  );
};

/** 過去走1行を表示する。 */
const PastPerformanceRow = ({ performance }: { performance: PastPerformanceDashboardView }) => {
  return (
    <tr className="align-middle">
      <td className="py-2 pr-3 text-app-subtle">{performance.dateLabel}</td>
      <td className="max-w-36 py-2 pr-3 font-medium text-app-text">{performance.raceName}</td>
      <td className="py-2 pr-3 text-app-subtle">{performance.conditionLabel}</td>
      <td className="py-2 pr-3 font-semibold text-app-text">{performance.finishPositionLabel}</td>
      <td className="py-2 pr-3 text-app-subtle">{performance.runningStyleLabel}</td>
    </tr>
  );
};
