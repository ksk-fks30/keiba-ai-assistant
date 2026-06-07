import type { ReactNode } from "react";

/** チップの見た目の種類。 */
type ChipVariant = "success" | "neutral" | "info";

/** 共通チップのprops。 */
interface ChipProps {
  /** チップ内に表示する内容。 */
  children: ReactNode;
  /** 親コンポーネント側で追加するTailwind class。 */
  className?: string;
  /** 状態に応じた見た目。 */
  variant?: ChipVariant;
}

/** 一覧や状態表示で使う小さなラベル。 */
export const Chip = ({ children, className, variant = "neutral" }: ChipProps) => {
  return (
    <span
      className={joinClassNames(
        "rounded-md px-2 py-0.5 text-xs font-bold",
        chipVariantClassNames[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

const chipVariantClassNames: Record<ChipVariant, string> = {
  success: "bg-turf-soft text-turf",
  neutral: "bg-app-muted text-app-subtle",
  info: "bg-info-soft text-info"
};

const joinClassNames = (...classNames: Array<string | undefined>): string => {
  return classNames.filter((className): className is string => className !== undefined).join(" ");
};
