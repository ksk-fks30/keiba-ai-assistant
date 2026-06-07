import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";

/** 共通セレクトのprops。 */
interface SelectProps extends Omit<ComponentPropsWithoutRef<"select">, "className"> {
  /** セレクトに紐づくラベル。 */
  label: string;
  /** option要素。 */
  children: ReactNode;
  /** 外側の配置に追加するTailwind class。 */
  className?: string;
  /** select要素自体に追加するTailwind class。 */
  selectClassName?: string;
}

/** フィルタや設定で使う共通セレクト。 */
export const Select = ({
  children,
  className,
  disabled = false,
  id,
  label,
  selectClassName,
  style,
  ...props
}: SelectProps) => {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const isDisabled = Boolean(disabled);

  return (
    <label className={joinClassNames("block", className)} htmlFor={selectId}>
      <span className="text-xs font-semibold text-app-subtle">{label}</span>
      <select
        {...props}
        className={joinClassNames(
          "mt-1 min-h-10 w-full cursor-pointer rounded-md border border-app-border bg-white px-3 py-2 text-sm font-semibold text-app-text outline-none transition focus:border-info focus:ring-2 focus:ring-info-soft disabled:cursor-not-allowed disabled:bg-app-muted disabled:text-app-subtle",
          selectClassName
        )}
        disabled={isDisabled}
        id={selectId}
        style={{ ...style, cursor: isDisabled ? "not-allowed" : "pointer" }}
      >
        {children}
      </select>
    </label>
  );
};

const joinClassNames = (...classNames: Array<string | undefined>): string => {
  return classNames.filter((className): className is string => className !== undefined).join(" ");
};
