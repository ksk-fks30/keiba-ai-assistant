import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@keiba-ai-assistant/web/components/ui/Button";

/** toastの種類。 */
type ToastKind = "success" | "error";

/** toastの背景表現。 */
type ToastPresentation = "surface" | "tinted";

/** 共通toastのprops。 */
interface ToastProps {
  /** 通知の種類。 */
  kind: ToastKind;
  /** 通知本文。 */
  message: string;
  /** 通知を閉じる操作。 */
  onClose: () => void;
  /** 通知本文の下に表示する追加要素。 */
  children?: ReactNode;
  /** 閉じるボタンをテキスト表示する場合のラベル。 */
  closeLabel?: string;
  /** toast全体の背景表現。 */
  presentation?: ToastPresentation;
}

/** アプリ共通の右下toast。 */
export const Toast = ({
  children,
  closeLabel,
  kind,
  message,
  onClose,
  presentation = "surface"
}: ToastProps) => {
  const isSurface = presentation === "surface";

  return (
    <aside
      className={
        isSurface
          ? "fixed right-4 bottom-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-panel border border-app-border bg-app-surface p-4 shadow-lg"
          : `fixed right-4 bottom-4 z-50 max-w-sm rounded-panel border px-4 py-3 shadow-lg ${toastTintClassNames[kind]}`
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={isSurface ? toastTextClassNames[kind] : "text-sm font-bold"}>{message}</p>
          {children}
        </div>
        <Button
          aria-label="通知を閉じる"
          className={closeLabel === undefined ? "shrink-0" : "ml-auto opacity-70 hover:opacity-100"}
          onClick={onClose}
          size={closeLabel === undefined ? "iconSm" : "sm"}
          type="button"
          variant="ghost"
        >
          {closeLabel === undefined ? <X aria-hidden="true" size={16} /> : closeLabel}
        </Button>
      </div>
    </aside>
  );
};

const toastTextClassNames: Record<ToastKind, string> = {
  success: "text-sm font-bold text-turf",
  error: "text-sm font-bold text-rose-700"
};

const toastTintClassNames: Record<ToastKind, string> = {
  success: "border-turf bg-turf-soft text-turf",
  error: "border-red-200 bg-red-50 text-red-700"
};
