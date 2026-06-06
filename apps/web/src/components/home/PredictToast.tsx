import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@keiba-ai-assistant/web/components/ui/Button";
import { Toast } from "@keiba-ai-assistant/web/components/ui/Toast";

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
    <Toast kind={toast.kind} message={toast.message} onClose={onClose}>
      {toast.raceId !== undefined ? (
        <ButtonLink
          className="mt-3"
          href={`/races/${encodeURIComponent(toast.raceId)}`}
          variant="secondary"
          weight="bold"
        >
          詳細
          <ArrowRight aria-hidden="true" size={16} />
        </ButtonLink>
      ) : null}
    </Toast>
  );
};
