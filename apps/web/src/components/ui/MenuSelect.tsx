import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/** メニュー型セレクトの選択肢。 */
export interface MenuSelectOption<Value extends string> {
  /** 選択時に呼び出し元へ返す値。 */
  value: Value;
  /** 選択肢の表示ラベル。 */
  label: string;
  /** 値の短い表示。未指定時はvalueを表示する。 */
  valueLabel?: ReactNode;
  /** 値表示に追加するTailwind class。 */
  valueClassName?: string;
}

/** 未選択へ戻す選択肢。 */
interface MenuSelectNullOption {
  /** 未選択行の表示ラベル。 */
  label: string;
  /** 未選択値の短い表示。 */
  valueLabel: ReactNode;
  /** 未選択値表示に追加するTailwind class。 */
  valueClassName?: string;
}

/** 共通メニュー型セレクトのprops。 */
export interface MenuSelectProps<Value extends string> {
  /** トリガーボタンのアクセシブル名。 */
  ariaLabel: string;
  /** 現在選択中の値。 */
  value: Value | null;
  /** 選択肢一覧。 */
  options: readonly MenuSelectOption<Value>[];
  /** 未選択へ戻す選択肢。省略時は未選択行を表示しない。 */
  nullOption?: MenuSelectNullOption | undefined;
  /** 操作を無効化するかどうか。 */
  disabled?: boolean | undefined;
  /** 保存中など一時状態でトリガーに表示する値。 */
  pendingLabel?: ReactNode;
  /** 一時状態として表示するかどうか。 */
  isPending?: boolean | undefined;
  /** 値が変更されたときに呼ぶ関数。 */
  onChange: (value: Value | null) => void;
  /** 外側の配置に追加するTailwind class。 */
  className?: string | undefined;
  /** トリガーボタンに追加するTailwind class。 */
  triggerClassName?: string | ((value: Value | null) => string) | undefined;
  /** メニューに追加するTailwind class。 */
  menuClassName?: string | undefined;
  /** メニュー幅のpx値。画面端の位置補正に使う。 */
  menuWidthPx?: number | undefined;
}

/** テーブル内やカード内から使える、body直下にメニューを出す共通セレクト。 */
export const MenuSelect = <Value extends string>({
  ariaLabel,
  className,
  disabled = false,
  isPending = false,
  menuClassName,
  menuWidthPx = 144,
  nullOption,
  onChange,
  options,
  pendingLabel = "…",
  triggerClassName,
  value
}: MenuSelectProps<Value>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(() => ({ left: 0, top: 0 }));
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updateOpenMenuPosition = (): void => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect === undefined) {
        return;
      }

      setMenuPosition(
        calculateMenuPosition({
          menuHeight: menuRef.current?.offsetHeight ?? 320,
          menuWidthPx,
          triggerRect: rect,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth
        })
      );
    };
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (buttonRef.current?.contains(target) === true || menuRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    updateOpenMenuPosition();
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateOpenMenuPosition);
    window.addEventListener("scroll", updateOpenMenuPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateOpenMenuPosition);
      window.removeEventListener("scroll", updateOpenMenuPosition, true);
    };
  }, [isOpen, menuWidthPx]);

  return (
    <div className={joinClassNames("inline-flex", className)}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        className={resolveTriggerClassName(triggerClassName, value)}
        disabled={disabled}
        onClick={() => {
          if (!isOpen) {
            const rect = buttonRef.current?.getBoundingClientRect();
            if (rect !== undefined && typeof window !== "undefined") {
              setMenuPosition(
                calculateMenuPosition({
                  menuHeight: 320,
                  menuWidthPx,
                  triggerRect: rect,
                  viewportHeight: window.innerHeight,
                  viewportWidth: window.innerWidth
                })
              );
            }
          }
          setIsOpen((current) => !current);
        }}
        ref={buttonRef}
        type="button"
      >
        {isPending ? pendingLabel : formatSelectedValue(value, selectedOption, nullOption)}
      </button>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <MenuSelectList
              menuClassName={menuClassName}
              menuRef={menuRef}
              nullOption={nullOption}
              onChange={(nextValue) => {
                setIsOpen(false);
                onChange(nextValue);
              }}
              options={options}
              position={menuPosition}
            />,
            document.body
          )
        : null}
    </div>
  );
};

interface MenuSelectListProps<Value extends string> {
  /** メニューに追加するTailwind class。 */
  menuClassName?: string | undefined;
  /** メニューDOMへの参照。 */
  menuRef: RefObject<HTMLDivElement | null>;
  /** 未選択へ戻す選択肢。 */
  nullOption?: MenuSelectNullOption | undefined;
  /** 選択時に呼ぶ関数。 */
  onChange: (value: Value | null) => void;
  /** 選択肢一覧。 */
  options: readonly MenuSelectOption<Value>[];
  /** メニュー表示位置。 */
  position: { left: number; top: number };
}

/** 共通セレクトの選択肢メニュー。 */
const MenuSelectList = <Value extends string>({
  menuClassName,
  menuRef,
  nullOption,
  onChange,
  options,
  position
}: MenuSelectListProps<Value>) => {
  return (
    <div
      className={joinClassNames(
        "fixed z-[9999] max-h-80 w-36 overflow-y-auto rounded-md border border-app-border bg-white py-1 text-left shadow-lg",
        menuClassName
      )}
      ref={menuRef}
      role="menu"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`
      }}
    >
      {nullOption === undefined ? null : (
        <MenuSelectItem
          label={nullOption.label}
          onSelect={() => {
            onChange(null);
          }}
          valueClassName={nullOption.valueClassName}
          valueLabel={nullOption.valueLabel}
        />
      )}
      {options.map((option) => (
        <MenuSelectItem
          key={option.value}
          label={option.label}
          onSelect={() => {
            onChange(option.value);
          }}
          valueClassName={option.valueClassName}
          valueLabel={option.valueLabel ?? option.value}
        />
      ))}
    </div>
  );
};

/** 共通セレクトの選択肢1件。 */
const MenuSelectItem = ({
  label,
  onSelect,
  valueClassName,
  valueLabel
}: {
  label: string;
  onSelect: () => void;
  valueClassName?: string | undefined;
  valueLabel: ReactNode;
}) => {
  return (
    <button
      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm font-semibold text-app-text hover:bg-app-muted"
      onClick={onSelect}
      role="menuitem"
      type="button"
    >
      <span className={joinClassNames("w-5 text-center text-base", valueClassName)}>
        {valueLabel}
      </span>
      <span>{label}</span>
    </button>
  );
};

const formatSelectedValue = <Value extends string>(
  value: Value | null,
  selectedOption: MenuSelectOption<Value> | null,
  nullOption: MenuSelectNullOption | undefined
): ReactNode => {
  if (value === null) {
    return nullOption?.valueLabel ?? "-";
  }

  return selectedOption?.valueLabel ?? value;
};

interface CalculateMenuPositionInput {
  /** トリガーボタンのviewport上の位置。 */
  triggerRect: DOMRect;
  /** メニューの高さ。 */
  menuHeight: number;
  /** メニューの幅。 */
  menuWidthPx: number;
  /** viewportの高さ。 */
  viewportHeight: number;
  /** viewportの幅。 */
  viewportWidth: number;
}

/** トリガーボタンを基準に、viewport内へ収まるメニュー位置を計算する。 */
const calculateMenuPosition = ({
  menuHeight,
  menuWidthPx,
  triggerRect,
  viewportHeight,
  viewportWidth
}: CalculateMenuPositionInput): { left: number; top: number } => {
  const preferredTop = triggerRect.bottom + 4;
  const canOpenBelow = preferredTop + menuHeight <= viewportHeight - 8;
  const left = Math.max(8, Math.min(triggerRect.left, viewportWidth - menuWidthPx - 8));

  return {
    left,
    top: canOpenBelow ? preferredTop : Math.max(8, triggerRect.top - menuHeight - 4)
  };
};

const resolveTriggerClassName = <Value extends string>(
  className: string | ((value: Value | null) => string) | undefined,
  value: Value | null
): string => {
  if (typeof className === "function") {
    return className(value);
  }

  return joinClassNames(
    "inline-flex min-h-8 cursor-pointer items-center justify-center rounded-md border border-app-border bg-white px-3 py-1 text-sm font-semibold text-app-text transition hover:border-app-border disabled:cursor-not-allowed disabled:bg-app-muted disabled:text-app-subtle",
    className
  );
};

const joinClassNames = (...classNames: Array<string | undefined>): string => {
  return classNames.filter((className): className is string => className !== undefined).join(" ");
};
