import { useEffect, useState } from "react";
import type { LessonEntry, RaceReflection, RaceResult } from "@keiba-ai-assistant/models";
import { Button } from "@keiba-ai-assistant/web/components/ui/Button";

/** レース結果カードのprops。 */
interface RaceResultCardProps {
  /** 保存済みレース結果。 */
  result: RaceResult;
  /** 保存済み振り返り本文。 */
  reflection: RaceReflection;
  /** 振り返りから生成したLesson候補。 */
  lessons: LessonEntry[];
}

/** 結果表、AI振り返り、Lesson候補を表示するカード。 */
export const RaceResultCard = ({ result, reflection, lessons }: RaceResultCardProps) => {
  const [lessonRows, setLessonRows] = useState(lessons);
  const [approvingLessonIds, setApprovingLessonIds] = useState<Set<string>>(new Set());
  const [approveError, setApproveError] = useState<string | null>(null);

  useEffect(() => {
    setLessonRows(lessons);
  }, [lessons]);

  const approveLesson = async (lessonId: string): Promise<void> => {
    if (approvingLessonIds.has(lessonId)) {
      return;
    }

    setApproveError(null);
    setApprovingLessonIds((current) => new Set(current).add(lessonId));
    try {
      const lesson = await requestApproveLesson(lessonId);
      setLessonRows((current) =>
        current.map((item) => (item.id === lesson.id ? { ...item, ...lesson } : item))
      );
    } catch (error) {
      setApproveError(readErrorMessage(error));
    } finally {
      setApprovingLessonIds((current) => {
        const next = new Set(current);
        next.delete(lessonId);
        return next;
      });
    }
  };

  return (
    <section className="shrink-0 overflow-hidden rounded-panel border border-app-border bg-app-surface shadow-sm">
      <div className="border-b border-app-border-soft px-5 py-4">
        <h2 className="text-lg font-bold text-app-text">レース結果</h2>
        <p className="mt-1 text-sm text-app-subtle">
          取得日時 {formatDateTime(result.collectedAt)} / 振り返り{" "}
          {formatDateTime(reflection.reflectedAt)}
        </p>
      </div>
      <div className="space-y-6 p-5">
        <ResultTable result={result} />
        <section>
          <h3 className="text-sm font-bold text-app-text">AIの振り返り</h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-7 text-app-text">
            {reflection.summary}
          </p>
        </section>
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-app-text">今後活かせる点</h3>
            {approveError === null ? null : (
              <p className="text-xs font-medium text-red-700">{approveError}</p>
            )}
          </div>
          <LessonTable
            lessons={lessonRows}
            approvingLessonIds={approvingLessonIds}
            onApprove={approveLesson}
          />
        </section>
      </div>
    </section>
  );
};

/** 着順表を表示する。 */
const ResultTable = ({ result }: { result: RaceResult }) => {
  if (result.entries.length === 0) {
    return (
      <p className="rounded-md border border-app-border-soft bg-app-muted px-3 py-3 text-sm text-app-subtle">
        結果表を読み取れませんでした。
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-b border-app-border-soft text-left text-sm">
        <thead className="bg-app-muted text-xs font-semibold text-app-subtle">
          <tr>
            <th className="w-16 px-4 py-3 text-center">着順</th>
            <th className="w-16 px-4 py-3 text-center">馬番</th>
            <th className="min-w-44 px-4 py-3">馬名</th>
            <th className="px-4 py-3">騎手</th>
            <th className="w-20 px-2 py-3 text-center">人気</th>
            <th className="w-28 px-4 py-3 text-right">オッズ</th>
            <th className="w-24 px-2 py-3 text-center">タイム</th>
            <th className="px-4 py-3">着差</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border-soft">
          {result.entries.map((entry, index) => (
            <tr key={`${entry.rank}-${entry.horseName}-${index}`} className="align-middle">
              <td className="px-4 py-3 text-center font-bold text-app-text">{entry.rank}</td>
              <td className="px-4 py-3 text-center font-semibold text-app-text">
                {entry.horseNumber ?? "-"}
              </td>
              <td className="px-4 py-3 font-semibold text-app-text">{entry.horseName}</td>
              <td className="px-4 py-3 text-app-text">{entry.jockey || "-"}</td>
              <td
                className={`w-20 px-2 py-3 text-center ${getPopularityCellColorClass(
                  entry.popularity ?? undefined
                )}`}
              >
                <PopularityText
                  label={entry.popularity === null ? "-" : String(entry.popularity)}
                />
              </td>
              <td className="w-28 px-4 py-3 text-right font-semibold text-app-text">
                {entry.odds === null ? "-" : entry.odds.toFixed(1)}
              </td>
              <td className="w-24 px-2 py-3 text-center text-app-text">{entry.time || "-"}</td>
              <td className="px-4 py-3 text-app-text">{entry.margin || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

/** Lesson候補一覧を表示する。 */
const LessonTable = ({
  lessons,
  approvingLessonIds,
  onApprove
}: {
  lessons: LessonEntry[];
  approvingLessonIds: Set<string>;
  onApprove: (lessonId: string) => Promise<void>;
}) => {
  if (lessons.length === 0) {
    return (
      <p className="mt-3 rounded-md border border-app-border-soft bg-app-muted px-3 py-3 text-sm text-app-subtle">
        保存する知見はありません。
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full border-b border-app-border-soft text-left text-sm">
        <thead className="bg-app-muted text-xs font-semibold text-app-subtle">
          <tr>
            <th className="min-w-52 px-4 py-3">キー</th>
            <th className="min-w-72 px-4 py-3">判断</th>
            <th className="min-w-44 px-4 py-3">タグ</th>
            <th className="w-24 px-4 py-3 text-center">確信度</th>
            <th className="w-24 px-4 py-3 text-center">状態</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border-soft">
          {lessons.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              isApproving={approvingLessonIds.has(lesson.id)}
              onApprove={onApprove}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Lesson候補の1行を表示する。 */
const LessonRow = ({
  lesson,
  isApproving,
  onApprove
}: {
  lesson: LessonEntry;
  isApproving: boolean;
  onApprove: (lessonId: string) => Promise<void>;
}) => {
  const handleApprove = async (): Promise<void> => {
    await onApprove(lesson.id);
  };

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="font-semibold text-app-text">{lesson.title}</div>
        <div className="mt-1 text-xs leading-relaxed text-app-subtle">{lesson.situationKey}</div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm leading-6 text-app-text">{lesson.decisionGuidance}</p>
        <p className="mt-2 text-xs leading-6 text-app-subtle">{lesson.diaryText}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {lesson.tags.map((tag) => (
            <span
              key={`${lesson.id}-${tag}`}
              className="rounded-md border border-app-border-soft bg-white px-2 py-1 text-xs font-medium text-app-subtle"
            >
              {tag}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-center text-app-text">{formatConfidence(lesson.confidence)}</td>
      <td className="px-4 py-3 text-center">
        {lesson.status === "draft" ? (
          <Button
            className="min-w-16"
            disabledPresentation="opacity"
            disabled={isApproving}
            onClick={handleApprove}
            size="sm"
            type="button"
            variant="outline"
          >
            {isApproving ? "採用中..." : "採用"}
          </Button>
        ) : (
          <span className="text-xs font-semibold text-app-subtle">
            {formatLessonStatus(lesson.status)}
          </span>
        )}
      </td>
    </tr>
  );
};

/** Lesson採用APIへリクエストする。 */
const requestApproveLesson = async (lessonId: string): Promise<LessonEntry> => {
  const response = await fetch(`/lessons/${encodeURIComponent(lessonId)}/approve`, {
    method: "POST",
    headers: { accept: "application/json" }
  });
  const value = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(readErrorResponse(value));
  }

  return value as LessonEntry;
};

/** 日時文字列を画面表示用に整形する。 */
const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
};

/** Lessonの状態を日本語表示にする。 */
const formatLessonStatus = (status: LessonEntry["status"]): string => {
  if (status === "approved") {
    return "採用済み";
  }
  if (status === "archived") {
    return "アーカイブ";
  }

  return "未採用";
};

/** Lessonの確信度を日本語表示にする。 */
const formatConfidence = (confidence: LessonEntry["confidence"]): string => {
  if (confidence === "high") {
    return "高";
  }
  if (confidence === "medium") {
    return "中";
  }

  return "低";
};

/** JSON error responseから表示用メッセージを取り出す。 */
const readErrorResponse = (value: unknown): string => {
  if (typeof value === "object" && value !== null && "error" in value) {
    const error = value.error;
    if (typeof error === "string") {
      return error;
    }
  }

  return "Lessonの採用に失敗しました。";
};

/** unknown の例外値から表示用メッセージを取り出す。 */
const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Lessonの採用に失敗しました。";
};
