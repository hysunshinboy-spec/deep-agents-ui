"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/providers/I18nProvider";

interface ThreadBatchToolbarProps {
  /** 当前列表中真实存在且被勾选的会话数。 */
  selectedCount: number;
  /** 可勾选的会话数，即列表中所有非运行中的会话。 */
  selectableCount: number;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onDelete: () => void;
  onExit: () => void;
}

export function ThreadBatchToolbar({
  selectedCount,
  selectableCount,
  allSelected,
  someSelected,
  onToggleAll,
  onDelete,
  onExit,
}: ThreadBatchToolbarProps) {
  const { t } = useI18n();
  const toggleLabel = allSelected
    ? t("threads.clearSelection")
    : t("threads.selectAll");

  return (
    <div
      role="toolbar"
      aria-label={t("threads.selectionToolbar")}
      className="flex flex-shrink-0 items-center gap-3 border-b border-border bg-[var(--color-surface)] px-3 py-2"
    >
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          disabled={selectableCount === 0}
          onCheckedChange={onToggleAll}
          aria-label={toggleLabel}
        />
        {toggleLabel}
      </label>

      {/* aria-live 只挂在数量上。挂到整个工具条上会让读屏在每次焦点移动时
          把全部按钮重念一遍。 */}
      <span
        aria-live="polite"
        className="text-xs text-muted-foreground"
      >
        {t("threads.selectedCount", { count: selectedCount })}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={selectedCount === 0}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("threads.deleteSelected")}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onExit}
          className="h-8 w-8"
          aria-label={t("threads.exitSelectMode")}
          title={t("threads.exitSelectMode")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
