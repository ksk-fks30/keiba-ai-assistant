import { useForm } from "@inertiajs/react";
import { SendHorizontal } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";

/** 追加質問フォームのprops。 */
interface QuestionPanelProps {
  /** 追加質問対象のrace ID。 */
  raceId: string;
  /** prediction.jsonが保存済みで質問可能な状態かどうか。 */
  canAsk: boolean;
  /** 直前の追加質問で発生したエラー。ない場合はnull。 */
  askError: string | null;
}

/** レース分析に対する追加質問を送信するフォーム。 */
export const QuestionPanel = ({ raceId, canAsk, askError }: QuestionPanelProps) => {
  const form = useForm({
    question: ""
  });
  const trimmedQuestion = form.data.question.trim();
  const canSubmit = canAsk && trimmedQuestion.length > 0 && !form.processing;

  const submitQuestion = () => {
    if (!canSubmit) {
      return;
    }

    // 回答生成後は同じレース詳細へ戻るため、履歴はサーバー側propsの再読込で反映する。
    form.post(`/races/${raceId}/ask`, {
      preserveScroll: true,
      onSuccess: () => {
        form.reset("question");
      }
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitQuestion();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submitQuestion();
    }
  };

  return (
    <section className="border-t border-app-border-soft bg-app-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-app-text">質問する</h3>
        {form.processing ? (
          <span className="text-xs font-semibold text-info">回答生成中（最大3分）</span>
        ) : null}
      </div>
      <form className="mt-3" method="post" action={`/races/${raceId}/ask`} onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="race-question">
          質問
        </label>
        <div className="relative">
          <textarea
            id="race-question"
            name="question"
            rows={2}
            value={form.data.question}
            disabled={!canAsk || form.processing}
            required
            onChange={(event) => {
              form.setData("question", event.currentTarget.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="展開、買い目、評価理由について聞く"
            className="block min-h-20 w-full resize-none rounded-md border border-app-border bg-white py-2 pr-12 pl-3 text-sm leading-relaxed text-app-text shadow-sm outline-none transition focus:border-info focus:ring-2 focus:ring-info-soft disabled:bg-app-muted disabled:text-app-subtle"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="質問を送信"
            title="質問を送信"
            className="absolute right-2 bottom-2 inline-flex size-8 items-center justify-center rounded-md bg-turf text-white shadow-sm transition hover:bg-turf-dark disabled:cursor-not-allowed disabled:bg-app-border disabled:text-app-subtle"
          >
            <SendHorizontal aria-hidden="true" size={16} strokeWidth={2.25} />
          </button>
        </div>
        {form.errors.question !== undefined ? (
          <p className="mt-2 text-xs font-semibold text-rose-700">{form.errors.question}</p>
        ) : null}
        {askError !== null ? (
          <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold leading-relaxed text-rose-700">
            {askError}
          </p>
        ) : null}
        {!canAsk ? (
          <p className="mt-2 text-xs leading-relaxed text-app-subtle">
            prediction.json が保存されると質問できます。
          </p>
        ) : null}
      </form>
    </section>
  );
};
