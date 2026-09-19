"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

interface CheckboxProps
  extends Omit<React.ComponentProps<"input">, "type" | "checked" | "onChange"> {
  checked: boolean;
  /**
   * 半选态（部分行被勾选时的「全选」框）。这是 DOM 属性而非 HTML attribute，
   * React 不会代为设置，只能拿到 ref 后命令式赋值。
   */
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * 用原生 `input[type=checkbox]` 而不是自绘一个 `div[role=checkbox]`：
 * 键盘切换、读屏语义、indeterminate 自动映射成 `aria-checked="mixed"`
 * 这些都白拿，自己画要一件件补且容易漏掉边缘行为。
 * 外观只覆盖一层 `appearance-none`，让它跟主题走。
 */
function Checkbox({
  className,
  checked,
  indeterminate = false,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  // 用状态算出类名，而不是叠 checked:/indeterminate: 变体：两个变体同时命中时
  // 谁的样式生效取决于 CSS 源码顺序，不如直接算出来确定。
  const filled = checked || indeterminate;

  return (
    <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        data-slot="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        className={cn(
          "size-4 cursor-pointer appearance-none rounded-[4px] border border-[var(--color-border)] bg-background transition-colors",
          "focus-visible:ring-[var(--color-primary)]/40 focus-visible:outline-none focus-visible:ring-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          filled && "border-[var(--color-primary)] bg-[var(--color-primary)]",
          className
        )}
        {...props}
      />
      {/* 图标叠在 input 之上；pointer-events-none 保证点击仍然落在 input 上 */}
      {filled && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[var(--color-primary-foreground)]">
          {checked ? (
            <Check
              className="size-3"
              strokeWidth={3}
            />
          ) : (
            <Minus
              className="size-3"
              strokeWidth={3}
            />
          )}
        </span>
      )}
    </span>
  );
}

export { Checkbox };
