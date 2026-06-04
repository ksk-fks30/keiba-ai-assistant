import type { QaEntry } from "@keiba-ai-assistant/models";

/** Q&A履歴表示のprops。 */
interface QuestionHistoryProps {
  /** 保存済みqa.jsonlを検証したdomain model配列。 */
  entries: QaEntry[];
}

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

/** 追加質問の履歴をAI分析パネル内で確認できる形に表示する。 */
export const QuestionHistory = ({ entries }: QuestionHistoryProps) => {
  if (entries.length === 0) {
    return (
      <section className="border-t border-app-border-soft p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold text-app-text">追加質問</h3>
          <span className="text-xs font-medium text-app-subtle">0件</span>
        </div>
        <div className="mt-3 rounded-md border border-dashed border-app-border-soft bg-app-muted px-4 py-4">
          <p className="text-sm font-semibold text-app-text">Q&A履歴はまだありません</p>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-app-border-soft p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-app-text">追加質問</h3>
        <span className="text-xs font-medium text-app-subtle">{entries.length}件</span>
      </div>
      <ol className="mt-3 space-y-3">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-md border border-app-border-soft bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold leading-relaxed text-app-text">{entry.question}</p>
              <time className="shrink-0 text-xs font-medium text-app-subtle">
                {formatCreatedAt(entry.createdAt)}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-app-text">
              {entry.answer}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
};

/** Q&A作成日時を YY/mm/dd HH:mm 形式に整形する。 */
const formatCreatedAt = (value: string): string => {
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
