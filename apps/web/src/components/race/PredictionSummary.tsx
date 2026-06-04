import type { Prediction } from "@keiba-ai-assistant/models";
import type { HorseDashboardView } from "@keiba-ai-assistant/web/components/race/use-race-dashboard-view";

/** AI分析エリアのprops。 */
interface PredictionSummaryProps {
  /** 保存済みprediction.jsonを検証したdomain model。未生成の場合はnull。 */
  prediction: Prediction | null;
  /** レース側に表示している出走馬一覧。馬IDを馬名へ解決するために使う。 */
  horses: HorseDashboardView[];
}

/** 保存済みのAI分析結果を、レース情報の右側に置く分析パネルとして表示する。 */
export const PredictionSummary = ({ prediction, horses }: PredictionSummaryProps) => {
  if (prediction === null) {
    return (
      <aside className="rounded-panel border border-app-border bg-app-surface p-5 shadow-sm">
        <PanelHeader generatedAtLabel="未生成" />
        <div className="mt-5 rounded-md border border-dashed border-app-border bg-app-muted px-4 py-5">
          <p className="text-sm font-semibold text-app-text">AI分析はまだありません</p>
          <p className="mt-2 text-sm leading-relaxed text-app-subtle">
            このレースの prediction.json がまだ保存されていません。
          </p>
        </div>
      </aside>
    );
  }

  const horseNameById = buildHorseNameById(horses);

  return (
    <aside className="rounded-panel border border-app-border bg-app-surface shadow-sm xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
      <div className="p-5">
        <PanelHeader generatedAtLabel={formatGeneratedAt(prediction.generatedAt)} />
        <section className="mt-5">
          <h3 className="text-sm font-bold text-app-text">総評</h3>
          <p className="mt-2 text-sm leading-relaxed text-app-text">{prediction.summary}</p>
        </section>
      </div>
      <section className="border-t border-app-border p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold text-app-text">馬別評価</h3>
          <span className="text-xs font-medium text-app-subtle">
            {prediction.evaluations.length}頭
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {prediction.evaluations.map((evaluation) => (
            <article key={evaluation.horseId} className="rounded-md border border-app-border p-3">
              <div className="relative pr-14">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-sm font-bold text-app-text">
                      {resolveHorseName(evaluation.horseId, horseNameById)}
                    </p>
                    <MarkChip mark={evaluation.mark} />
                  </div>
                </div>
                <div className="absolute right-0 top-0 text-right">
                  <div className="text-lg font-bold text-turf">{evaluation.score}</div>
                  <div className="text-xs text-app-subtle">score</div>
                </div>
              </div>
              <ReasonList title="評価理由" items={evaluation.reasons} />
              <ReasonList title="リスク" items={evaluation.risks} />
            </article>
          ))}
        </div>
      </section>
      <section className="border-t border-app-border p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold text-app-text">買い目候補</h3>
          <span className="text-xs font-medium text-app-subtle">
            {prediction.betCandidates.length}件
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {prediction.betCandidates.map((candidate) => (
            <article
              key={`${candidate.type}-${candidate.horses.join("-")}-${candidate.stakeWeight}`}
              className="rounded-md border border-app-border bg-app-muted p-3"
            >
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-2">
                <div>
                  <p className="text-xs font-semibold text-app-subtle">券種</p>
                  <p className="mt-1 text-sm font-bold text-app-text">{candidate.type}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-app-subtle">買い目</p>
                  <p className="mt-1 text-sm font-bold leading-snug text-app-text">
                    {candidate.horses
                      .map((horseId) => resolveHorseName(horseId, horseNameById))
                      .join(" / ")}
                  </p>
                </div>
                <div className="col-span-2 flex items-baseline gap-2 border-t border-app-border pt-2">
                  <span className="text-xs font-semibold text-app-subtle">配分</span>
                  <span className="text-sm font-bold text-app-text">
                    {candidate.stakeWeight}/100
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-app-text">{candidate.reason}</p>
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
};

/** AI分析パネルの見出しを表示する。 */
const PanelHeader = ({ generatedAtLabel }: { generatedAtLabel: string }) => {
  return (
    <header>
      <p className="text-xs font-semibold text-app-subtle">prediction.json</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold text-app-text">AI分析</h2>
        <span className="rounded-md border border-app-border px-2 py-1 text-xs font-semibold text-app-subtle">
          {generatedAtLabel}
        </span>
      </div>
    </header>
  );
};

/** AI評価の印を馬名横で見つけやすいチップとして表示する。 */
const MarkChip = ({ mark }: { mark: Prediction["evaluations"][number]["mark"] }) => {
  return (
    <span
      className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold ${getMarkChipColorClass(mark)}`}
    >
      {formatMark(mark)}
    </span>
  );
};

/** 印ごとにチップの色を変え、評価の強弱を視覚的に区別する。 */
const getMarkChipColorClass = (mark: Prediction["evaluations"][number]["mark"]): string => {
  const colorClasses = {
    favorite: "border-odds bg-odds-soft text-odds",
    second: "border-info bg-info-soft text-info",
    third: "border-yellow-300 bg-yellow-100 text-yellow-800",
    longshot: "border-rose-300 bg-rose-50 text-rose-700",
    watch: "border-app-border bg-app-muted text-app-text",
    dismiss: "border-app-border bg-white text-app-subtle"
  } as const;

  return colorClasses[mark];
};

/** 評価理由やリスクを短い箇条書きとして表示する。 */
const ReasonList = ({ title, items }: { title: string; items: string[] }) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-app-subtle">{title}</h4>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-xs leading-relaxed text-app-text">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

/** 馬IDから表示中の馬名を引けるMapを作る。 */
const buildHorseNameById = (horses: HorseDashboardView[]): Map<string, string> => {
  return new Map(horses.map((horse) => [horse.id, `${horse.horseNumberLabel} ${horse.name}`]));
};

/** Prediction内の馬IDを、表示可能な馬名へ解決する。 */
const resolveHorseName = (horseId: string, horseNameById: Map<string, string>): string => {
  return horseNameById.get(horseId) ?? horseId;
};

/** AI評価の印を画面表示用の日本語に変換する。 */
const formatMark = (mark: Prediction["evaluations"][number]["mark"]): string => {
  const labels = {
    favorite: "本命",
    second: "対抗",
    third: "単穴",
    longshot: "穴",
    watch: "注視",
    dismiss: "軽視"
  } as const;

  return labels[mark];
};

/** AI分析の生成日時を YY/mm/dd HH:mm 形式に整形する。 */
const formatGeneratedAt = (generatedAt: string): string => {
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) {
    return generatedAt;
  }

  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}/${month}/${day} ${hour}:${minute}`;
};
