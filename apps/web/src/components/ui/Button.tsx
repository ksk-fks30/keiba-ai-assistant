import type { ComponentPropsWithoutRef } from "react";

/** ボタンの見た目の種類。 */
type ButtonVariant = "primary" | "secondary" | "neutral" | "outline" | "danger" | "ghost";

/** ボタンの大きさ。 */
type ButtonSize = "md" | "sm" | "icon" | "iconSm";

/** ボタン文字の太さ。 */
type ButtonWeight = "medium" | "semibold" | "bold";

/** disabled時の視覚表現。 */
type ButtonDisabledPresentation = "muted" | "opacity";

/** 共通ボタンのprops。 */
interface ButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "className"> {
  /** 親コンポーネント側で追加するTailwind class。 */
  className?: string;
  /** ボタンの用途に応じた見た目。 */
  variant?: ButtonVariant;
  /** ボタンの大きさ。 */
  size?: ButtonSize;
  /** ボタン文字の太さ。 */
  weight?: ButtonWeight;
  /** disabled時に背景を薄くするか、透明度だけ落とすか。 */
  disabledPresentation?: ButtonDisabledPresentation;
}

/** ボタン風リンクのprops。 */
interface ButtonLinkProps extends Omit<ComponentPropsWithoutRef<"a">, "className"> {
  /** 親コンポーネント側で追加するTailwind class。 */
  className?: string;
  /** リンクの用途に応じた見た目。 */
  variant?: ButtonVariant;
  /** リンクの大きさ。 */
  size?: ButtonSize;
  /** リンク文字の太さ。 */
  weight?: ButtonWeight;
}

/** アプリ全体で使うクリック可能なボタン。 */
export const Button = ({
  children,
  className,
  disabled = false,
  disabledPresentation = "muted",
  size = "md",
  style,
  type = "button",
  variant = "primary",
  weight = "semibold",
  ...props
}: ButtonProps) => {
  const isDisabled = Boolean(disabled);

  return (
    <button
      {...props}
      className={joinClassNames(
        baseButtonClassName,
        buttonVariantClassNames[variant],
        buttonSizeClassNames[size],
        buttonWeightClassNames[weight],
        buttonDisabledPresentationClassNames[disabledPresentation],
        className
      )}
      disabled={isDisabled}
      style={{ ...style, cursor: isDisabled ? "not-allowed" : "pointer" }}
      type={type}
    >
      {children}
    </button>
  );
};

/** ボタンと同じ見た目で使うリンク。 */
export const ButtonLink = ({
  children,
  className,
  size = "md",
  style,
  variant = "secondary",
  weight = "semibold",
  ...props
}: ButtonLinkProps) => {
  return (
    <a
      {...props}
      className={joinClassNames(
        baseButtonClassName,
        buttonVariantClassNames[variant],
        buttonSizeClassNames[size],
        buttonWeightClassNames[weight],
        className
      )}
      style={{ ...style, cursor: "pointer" }}
    >
      {children}
    </a>
  );
};

const baseButtonClassName =
  "inline-flex cursor-pointer items-center justify-center rounded-md transition disabled:cursor-not-allowed";

const buttonVariantClassNames: Record<ButtonVariant, string> = {
  primary:
    "border border-turf bg-turf text-white shadow-sm hover:bg-turf-dark disabled:border-app-border",
  secondary:
    "border border-app-border bg-app-surface text-turf hover:bg-turf-soft disabled:border-app-border",
  neutral:
    "border border-app-border bg-app-surface text-app-subtle hover:bg-app-muted disabled:border-app-border",
  outline:
    "border border-turf bg-transparent text-turf hover:bg-turf-soft disabled:border-app-border",
  danger:
    "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:border-app-border",
  ghost: "border border-transparent bg-transparent text-current hover:bg-app-muted"
};

const buttonSizeClassNames: Record<ButtonSize, string> = {
  md: "min-h-10 gap-2 px-3 py-2 text-sm",
  sm: "min-h-8 gap-2 px-3 py-1.5 text-xs",
  icon: "size-8 p-0",
  iconSm: "size-7 p-0"
};

const buttonWeightClassNames: Record<ButtonWeight, string> = {
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold"
};

const buttonDisabledPresentationClassNames: Record<ButtonDisabledPresentation, string> = {
  muted: "disabled:bg-app-border disabled:text-app-subtle",
  opacity: "disabled:opacity-70"
};

const joinClassNames = (...classNames: Array<string | undefined>): string => {
  return classNames.filter((className): className is string => className !== undefined).join(" ");
};
