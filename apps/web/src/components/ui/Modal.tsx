import { useId, type ReactNode } from "react";

/** モーダル幅の種類。 */
type ModalSize = "md" | "lg";

/** 共通モーダルのprops。 */
interface ModalProps {
  /** モーダルを表示するかどうか。 */
  isOpen: boolean;
  /** モーダル見出し。 */
  title: string;
  /** モーダル本文。 */
  children: ReactNode;
  /** 下部に表示する操作ボタン群。 */
  footer?: ReactNode;
  /** モーダル幅。 */
  size?: ModalSize;
}

/** 画面中央に表示する共通モーダル。 */
export const Modal = ({ children, footer, isOpen, size = "md", title }: ModalProps) => {
  const titleId = useId();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`${modalSizeClassNames[size]} w-full rounded-panel border border-app-border bg-app-surface p-5 shadow-lg`}
        role="dialog"
      >
        <h2 className="text-lg font-bold text-app-text" id={titleId}>
          {title}
        </h2>
        <div className="mt-3 text-sm leading-6 text-app-text">{children}</div>
        {footer === undefined ? null : <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </section>
    </div>
  );
};

const modalSizeClassNames: Record<ModalSize, string> = {
  md: "max-w-md",
  lg: "max-w-2xl"
};
