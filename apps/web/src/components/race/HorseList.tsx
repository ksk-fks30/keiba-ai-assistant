import { useEffect, useState } from "react";
import {
  horseMemoMarks,
  type HorseMemo,
  type HorseMemoMark,
  type Prediction
} from "@keiba-ai-assistant/models";
import {
  formatAiHorseEvaluationMark,
  horseMemoMarkLabels
} from "@keiba-ai-assistant/web/components/race/horse-mark-view";
import {
  MenuSelect,
  type MenuSelectOption
} from "@keiba-ai-assistant/web/components/ui/MenuSelect";
import { TextInput } from "@keiba-ai-assistant/web/components/ui/TextInput";
import type {
  HorseDashboardView,
  PastPerformanceDashboardView
} from "@keiba-ai-assistant/web/components/race/use-race-dashboard-view";

/** 出走馬一覧のprops。 */
interface HorseListProps {
  /** URLパラメータで指定されたrace ID。 */
  raceId: string;
  /** ダッシュボード表示用に整形済みの出走馬一覧。 */
  horses: HorseDashboardView[];
  /** 保存済みprediction.jsonを検証したdomain model。未生成の場合はnull。 */
  prediction: Prediction | null;
  /** Web限定で保存した出走馬メモ。 */
  horseMemos: HorseMemo[];
}

/** race.json に含まれる出走馬、馬体重、オッズ、血統、直近成績を表示する。 */
export const HorseList = ({ raceId, horses, prediction, horseMemos }: HorseListProps) => {
  const [manualMarkByHorseId, setManualMarkByHorseId] = useState(() =>
    buildManualMarkByHorseId(horseMemos)
  );
  const [manualNoteByHorseId, setManualNoteByHorseId] = useState(() =>
    buildManualNoteByHorseId(horseMemos)
  );
  const [persistedNoteByHorseId, setPersistedNoteByHorseId] = useState(() =>
    buildManualNoteByHorseId(horseMemos)
  );
  const [savingHorseIds, setSavingHorseIds] = useState<Set<string>>(() => new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setManualMarkByHorseId(buildManualMarkByHorseId(horseMemos));
    const noteByHorseId = buildManualNoteByHorseId(horseMemos);
    setManualNoteByHorseId(noteByHorseId);
    setPersistedNoteByHorseId(noteByHorseId);
  }, [horseMemos]);

  const aiMarkByHorseId = buildAiMarkByHorseId(prediction);
  const saveHorseMemo = async (
    horseId: string,
    nextMark: HorseMemoMark | null,
    nextNote: string,
    rollbackNoteOnFailure: boolean
  ): Promise<void> => {
    const previousMark = manualMarkByHorseId.get(horseId) ?? null;
    const previousDraftNote = manualNoteByHorseId.get(horseId) ?? "";
    const previousPersistedNote = persistedNoteByHorseId.get(horseId) ?? "";
    setSaveError(null);
    setSavingHorseIds((current) => addSavingHorseId(current, horseId));
    setManualMarkByHorseId((current) => setHorseMark(current, horseId, nextMark));
    setManualNoteByHorseId((current) => setHorseNote(current, horseId, nextNote));

    try {
      const response = await fetch(`/races/${encodeURIComponent(raceId)}/horse-memos`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({ horseId, mark: nextMark, note: nextNote })
      });
      const payload = await readSaveHorseMemoResponse(response);
      if (!response.ok) {
        throw new Error(payload.error ?? "メモを保存できませんでした。");
      }

      setManualMarkByHorseId((current) =>
        setHorseMark(current, horseId, payload.memo?.mark ?? null)
      );
      setManualNoteByHorseId((current) => setHorseNote(current, horseId, payload.memo?.note ?? ""));
      setPersistedNoteByHorseId((current) =>
        setHorseNote(current, horseId, payload.memo?.note ?? "")
      );
    } catch {
      setManualMarkByHorseId((current) => setHorseMark(current, horseId, previousMark));
      setManualNoteByHorseId((current) =>
        setHorseNote(
          current,
          horseId,
          rollbackNoteOnFailure ? previousPersistedNote : previousDraftNote
        )
      );
      setSaveError("メモを保存できませんでした。");
    } finally {
      setSavingHorseIds((current) => removeSavingHorseId(current, horseId));
    }
  };
  const saveHorseMemoMark = async (
    horseId: string,
    nextMark: HorseMemoMark | null
  ): Promise<void> => {
    await saveHorseMemo(horseId, nextMark, manualNoteByHorseId.get(horseId) ?? "", false);
  };
  const saveHorseMemoNote = async (horseId: string, nextNote: string): Promise<void> => {
    if (nextNote === (persistedNoteByHorseId.get(horseId) ?? "")) {
      return;
    }

    await saveHorseMemo(horseId, manualMarkByHorseId.get(horseId) ?? null, nextNote, true);
  };

  return (
    <section className="shrink-0 overflow-hidden rounded-panel border border-app-border bg-app-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-app-border-soft px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-app-text">出走馬</h2>
          <p className="mt-1 text-sm text-app-subtle">{horses.length}頭</p>
        </div>
        {saveError === null ? null : (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
            {saveError}
          </p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] table-fixed border-b border-app-border-soft text-left text-sm">
          <colgroup>
            <col className="w-12" />
            <col className="w-12" />
            <col className="w-14" />
            <col className="w-48" />
            <col className="w-16" />
            <col className="w-24" />
            <col className="w-24" />
            <col className="w-16" />
            <col className="w-24" />
            <col />
          </colgroup>
          <thead className="bg-app-muted text-xs font-semibold text-app-subtle">
            <tr>
              <th className="w-12 px-2 py-3 text-center">印</th>
              <th className="w-12 px-2 py-3 text-center">AI</th>
              <th className="w-14 px-2 py-3 text-center">馬番</th>
              <th className="w-48 px-3 py-3">馬名</th>
              <th className="w-16 px-2 py-3">性齢</th>
              <th className="w-24 px-2 py-3">騎手</th>
              <th className="w-24 px-2 py-3">馬体重</th>
              <th className="w-16 px-2 py-3 text-center">人気</th>
              <th className="w-24 px-4 py-3 text-right">オッズ</th>
              <th className="px-3 py-3">メモ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border-soft">
            {horses.map((horse) => (
              <tr key={horse.id} className="align-middle">
                <td className="px-2 py-3 text-center">
                  <HorseMarkSelector
                    horseName={horse.name}
                    isSaving={savingHorseIds.has(horse.id)}
                    mark={manualMarkByHorseId.get(horse.id) ?? null}
                    onChange={async (nextMark) => {
                      await saveHorseMemoMark(horse.id, nextMark);
                    }}
                  />
                </td>
                <AiMarkCell mark={aiMarkByHorseId.get(horse.id) ?? null} />
                <td className="px-2 py-3 text-center font-bold text-app-text">
                  {horse.horseNumberLabel}
                </td>
                <td className="w-48 px-3 py-3">
                  <div className="truncate font-semibold text-app-text">{horse.name}</div>
                  <div className="mt-1 truncate text-xs text-app-subtle">{horse.trainerLabel}</div>
                </td>
                <td className="px-2 py-3 text-app-text">{horse.sexAgeLabel}</td>
                <td className="max-w-24 truncate px-2 py-3 text-app-text">{horse.jockeyLabel}</td>
                <td className="whitespace-nowrap px-2 py-3 text-app-text">
                  {horse.bodyWeightLabel}
                </td>
                <td
                  className={`w-16 px-2 py-3 text-center ${getPopularityCellColorClass(horse.popularity)}`}
                >
                  <PopularityText label={horse.popularityLabel} />
                </td>
                <td className="w-24 px-4 py-3 text-right font-semibold text-app-text">
                  {horse.oddsLabel}
                </td>
                <td className="px-3 py-3">
                  <TextInput
                    aria-label={`${horse.name}のメモ`}
                    disabled={savingHorseIds.has(horse.id)}
                    disabledCursor="wait"
                    onBlur={async (event) => {
                      await saveHorseMemoNote(horse.id, event.currentTarget.value);
                    }}
                    onChange={(event) => {
                      const nextNote = event.currentTarget.value;
                      setManualNoteByHorseId((current) =>
                        setHorseNote(current, horse.id, nextNote)
                      );
                    }}
                    value={manualNoteByHorseId.get(horse.id) ?? ""}
                  />
                </td>
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

/** 手動印を選択する小さなメニュー。 */
const HorseMarkSelector = ({
  horseName,
  mark,
  isSaving,
  onChange
}: {
  horseName: string;
  mark: HorseMemoMark | null;
  isSaving: boolean;
  onChange: (mark: HorseMemoMark | null) => void;
}) => {
  return (
    <MenuSelect
      ariaLabel={`${horseName}の印`}
      disabled={isSaving}
      isPending={isSaving}
      nullOption={{
        label: "未選択",
        valueLabel: "-",
        valueClassName: "text-app-subtle"
      }}
      onChange={onChange}
      options={horseMarkSelectOptions}
      triggerClassName={(currentMark) =>
        `inline-flex size-8 cursor-pointer items-center justify-center rounded-md border text-base font-bold transition disabled:cursor-wait ${
          currentMark === null
            ? "border-app-border-soft bg-white text-app-subtle hover:border-app-border"
            : getMarkSymbolClass(currentMark)
        }`
      }
      value={mark}
    />
  );
};

/** AI評価の印をセル背景付きで表示する。 */
const AiMarkCell = ({ mark }: { mark: HorseMemoMark | null }) => {
  return (
    <td className={`px-2 py-3 text-center ${getAiMarkCellColorClass(mark)}`}>
      <AiMarkText mark={mark} />
    </td>
  );
};

/** AI評価の印をセル内のテキストだけで表示する。 */
const AiMarkText = ({ mark }: { mark: HorseMemoMark | null }) => {
  if (mark === null) {
    return <span className="text-sm font-semibold text-app-subtle">-</span>;
  }

  return <span className={`text-base font-bold ${getMarkTextColorClass(mark)}`}>{mark}</span>;
};

/** AI印ごとのセル背景色を返す。 */
const getAiMarkCellColorClass = (mark: HorseMemoMark | null): string => {
  if (mark === null) {
    return "";
  }

  const colorClasses = {
    "◎": "bg-odds-soft",
    "◯": "bg-info-soft",
    "▲": "bg-yellow-100",
    "△": "bg-rose-50",
    "☆": "bg-violet-50",
    "✓": "bg-emerald-50",
    "✗": "bg-zinc-50"
  } satisfies Record<HorseMemoMark, string>;

  return colorClasses[mark];
};

/** 印ごとの小さな表示色を返す。 */
const getMarkSymbolClass = (mark: HorseMemoMark): string => {
  const colorClasses = {
    "◎": "border-odds bg-odds-soft text-odds",
    "◯": "border-info bg-info-soft text-info",
    "▲": "border-yellow-300 bg-yellow-100 text-yellow-800",
    "△": "border-rose-300 bg-rose-50 text-rose-700",
    "☆": "border-violet-300 bg-violet-50 text-violet-700",
    "✓": "border-emerald-300 bg-emerald-50 text-emerald-700",
    "✗": "border-app-border bg-white text-app-subtle"
  } satisfies Record<HorseMemoMark, string>;

  return colorClasses[mark];
};

/** メニュー内の印記号だけに付ける表示色を返す。 */
const getMarkTextColorClass = (mark: HorseMemoMark): string => {
  const colorClasses = {
    "◎": "text-odds",
    "◯": "text-info",
    "▲": "text-yellow-800",
    "△": "text-rose-700",
    "☆": "text-violet-700",
    "✓": "text-emerald-700",
    "✗": "text-app-subtle"
  } satisfies Record<HorseMemoMark, string>;

  return colorClasses[mark];
};

/** 手動印セレクトに表示する選択肢。 */
const horseMarkSelectOptions: MenuSelectOption<HorseMemoMark>[] = horseMemoMarks.map((mark) => ({
  value: mark,
  label: horseMemoMarkLabels[mark],
  valueLabel: mark,
  valueClassName: getMarkTextColorClass(mark)
}));

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

interface SaveHorseMemoResponse {
  /** 保存後の出走馬メモ。削除時はnull。 */
  memo?: HorseMemo | null;
  /** 保存に失敗した場合のメッセージ。 */
  error?: string | undefined;
}

/** 保存済みメモを馬IDから手動印へ引けるMapにする。 */
const buildManualMarkByHorseId = (horseMemos: HorseMemo[]): Map<string, HorseMemoMark> => {
  const markByHorseId = new Map<string, HorseMemoMark>();
  for (const memo of horseMemos) {
    if (memo.mark !== null) {
      markByHorseId.set(memo.horseId, memo.mark);
    }
  }

  return markByHorseId;
};

/** 保存済みメモを馬IDからテキストメモへ引けるMapにする。 */
const buildManualNoteByHorseId = (horseMemos: HorseMemo[]): Map<string, string> => {
  return new Map(horseMemos.map((memo) => [memo.horseId, memo.note]));
};

/** Predictionの評価を馬IDからAI印へ引けるMapにする。 */
const buildAiMarkByHorseId = (prediction: Prediction | null): Map<string, HorseMemoMark> => {
  if (prediction === null) {
    return new Map();
  }

  return new Map(
    prediction.evaluations.map((evaluation) => [
      evaluation.horseId,
      formatAiHorseEvaluationMark(evaluation.mark)
    ])
  );
};

/** 保存中の馬ID集合へ対象IDを追加する。 */
const addSavingHorseId = (current: Set<string>, horseId: string): Set<string> => {
  const next = new Set(current);
  next.add(horseId);
  return next;
};

/** 保存中の馬ID集合から対象IDを除く。 */
const removeSavingHorseId = (current: Set<string>, horseId: string): Set<string> => {
  const next = new Set(current);
  next.delete(horseId);
  return next;
};

/** 馬IDごとの手動印Mapを、追加・更新・削除に応じて作り直す。 */
const setHorseMark = (
  current: Map<string, HorseMemoMark>,
  horseId: string,
  mark: HorseMemoMark | null
): Map<string, HorseMemoMark> => {
  const next = new Map(current);
  if (mark === null) {
    next.delete(horseId);
    return next;
  }

  next.set(horseId, mark);
  return next;
};

/** 馬IDごとのテキストメモMapを、追加・更新・削除に応じて作り直す。 */
const setHorseNote = (
  current: Map<string, string>,
  horseId: string,
  note: string
): Map<string, string> => {
  const next = new Map(current);
  if (note.length === 0) {
    next.delete(horseId);
    return next;
  }

  next.set(horseId, note);
  return next;
};

/** 出走馬メモ保存routeのJSON応答を読み取る。 */
const readSaveHorseMemoResponse = async (response: Response): Promise<SaveHorseMemoResponse> => {
  try {
    const value = (await response.json()) as SaveHorseMemoResponse;
    return value;
  } catch {
    return {};
  }
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
