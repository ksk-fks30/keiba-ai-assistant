import { ArrowRight, X } from "lucide-react";

/** レース解析完了または失敗を通知するtoastの表示状態。 */
export interface PredictToast {
  /** 通知の種類。 */
  kind: "success" | "error";
  /** 通知本文。 */
  message: string;
  /** 完了したレースID。成功時に詳細リンクを表示するために使う。 */
  raceId?: string;
}

/** レース解析完了または失敗を通知するtoast。 */
export const PredictToastView = ({
  toast,
  onClose
}: {
  toast: PredictToast | null;
  onClose: () => void;
}) => {
  if (toast === null) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-panel border border-app-border bg-app-surface p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={
              toast.kind === "success"
                ? "text-sm font-bold text-turf"
                : "text-sm font-bold text-rose-700"
            }
          >
            {toast.message}
          </p>
          {toast.raceId !== undefined ? (
            <a
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-app-border px-3 py-2 text-sm font-bold text-turf transition hover:bg-turf-soft"
              href={`/races/${encodeURIComponent(toast.raceId)}`}
            >
              詳細
              <ArrowRight aria-hidden="true" size={16} />
            </a>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="通知を閉じる"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-app-subtle transition hover:bg-app-muted"
          onClick={onClose}
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  );
};
