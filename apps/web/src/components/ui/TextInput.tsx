import type { ComponentPropsWithoutRef } from "react";

/** disabled時のカーソル表現。 */
type TextInputDisabledCursor = "notAllowed" | "wait";

/** 共通テキスト入力のprops。 */
interface TextInputProps extends Omit<ComponentPropsWithoutRef<"input">, "className" | "type"> {
  /** 親コンポーネント側で追加するTailwind class。 */
  className?: string;
  /** disabled時のカーソル表現。 */
  disabledCursor?: TextInputDisabledCursor;
}

/** テーブルやフォームで使う共通テキスト入力。 */
export const TextInput = ({
  className,
  disabled = false,
  disabledCursor = "notAllowed",
  style,
  ...props
}: TextInputProps) => {
  const isDisabled = Boolean(disabled);

  return (
    <input
      {...props}
      className={joinClassNames(
        "h-9 w-full rounded-md border border-app-border-soft bg-white px-2 text-sm text-app-text outline-none transition focus:border-info disabled:bg-app-muted",
        textInputDisabledCursorClassNames[disabledCursor],
        className
      )}
      disabled={isDisabled}
      style={style}
      type="text"
    />
  );
};

const textInputDisabledCursorClassNames: Record<TextInputDisabledCursor, string> = {
  notAllowed: "disabled:cursor-not-allowed",
  wait: "disabled:cursor-wait"
};

const joinClassNames = (...classNames: Array<string | undefined>): string => {
  return classNames.filter((className): className is string => className !== undefined).join(" ");
};
