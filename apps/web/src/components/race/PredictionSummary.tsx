import {
  type PredictionSummaryProps,
  usePredictionSummary
} from "@keiba-ai-assistant/web/components/race/use-prediction-summary";

/** 保存済みのAI分析結果を、レース情報の右側に置く分析パネルとして表示する。 */
export const PredictionSummary = (props: PredictionSummaryProps) => {
  const view = usePredictionSummary(props);

  if (view.status === "empty") {
    return (
      <section className="p-5">
        <PanelHeader generatedAtLabel={view.generatedAtLabel} />
        <div className="mt-5 rounded-md border border-dashed border-app-border-soft bg-app-muted px-4 py-5">
          <p className="text-sm font-semibold text-app-text">AI分析はまだありません</p>
          <p className="mt-2 text-sm leading-relaxed text-app-subtle">
            このレースの prediction.json がまだ保存されていません。
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="p-5">
        <PanelHeader generatedAtLabel={view.generatedAtLabel} />
        <section className="mt-5">
          <h3 className="text-sm font-bold text-app-text">総評</h3>
          <p className="mt-2 text-sm leading-relaxed text-app-text">{view.summary}</p>
        </section>
      </div>
      <section className="border-t border-app-border-soft p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold text-app-text">馬別評価</h3>
          <span className="text-xs font-medium text-app-subtle">{view.evaluationCountLabel}</span>
        </div>
        <div className="mt-3 space-y-3">
          {view.evaluations.map((evaluation) => (
            <article key={evaluation.key} className="rounded-md border border-app-border-soft p-3">
              <div className="relative pr-14">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-sm font-bold text-app-text">
                      {evaluation.horseName}
                    </p>
                    <MarkChip colorClass={evaluation.markColorClass} label={evaluation.markLabel} />
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
      <section className="border-t border-app-border-soft p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold text-app-text">買い目候補</h3>
          <span className="text-xs font-medium text-app-subtle">{view.betCandidateCountLabel}</span>
        </div>
        <div className="mt-3 space-y-3">
          {view.betCandidates.map((candidate) => (
            <article
              key={candidate.key}
              className="rounded-md border border-app-border-soft bg-app-muted p-3"
            >
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-2">
                <div>
                  <p className="text-xs font-semibold text-app-subtle">券種</p>
                  <p className="mt-1 text-sm font-bold text-app-text">{candidate.typeLabel}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-app-subtle">買い目</p>
                  <p className="mt-1 text-sm font-bold leading-snug text-app-text">
                    {candidate.horsesLabel}
                  </p>
                </div>
                <div className="col-span-2 flex items-baseline gap-2 border-t border-app-border-soft pt-2">
                  <span className="text-xs font-semibold text-app-subtle">配分</span>
                  <span className="text-sm font-bold text-app-text">
                    {candidate.stakeWeightLabel}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-app-text">{candidate.reason}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
};

/** AI分析パネルの見出しを表示する。 */
const PanelHeader = ({ generatedAtLabel }: { generatedAtLabel: string }) => {
  return (
    <header>
      <p className="text-xs font-semibold text-app-subtle">prediction.json</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold text-app-text">AI分析</h2>
        <span className="rounded-md border border-app-border-soft px-2 py-1 text-xs font-semibold text-app-subtle">
          {generatedAtLabel}
        </span>
      </div>
    </header>
  );
};

/** AI評価の印を馬名横で見つけやすいチップとして表示する。 */
const MarkChip = ({ colorClass, label }: { colorClass: string; label: string }) => {
  return (
    <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold ${colorClass}`}>
      {label}
    </span>
  );
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
