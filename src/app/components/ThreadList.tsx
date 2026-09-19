"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { format, type Locale } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { ListChecks, Loader2, MessageSquare, Trash2, X } from "lucide-react";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ThreadItem } from "@/app/hooks/useThreads";
import { useThreads } from "@/app/hooks/useThreads";
import { translate, type Language } from "@/lib/i18n";
import { useI18n } from "@/providers/I18nProvider";
import {
  DeleteThreadDialog,
  type DeleteOutcome,
} from "@/app/components/DeleteThreadDialog";
import { ThreadBatchToolbar } from "@/app/components/ThreadBatchToolbar";

type StatusFilter = "all" | "idle" | "busy" | "interrupted" | "error";

const GROUP_LABEL_KEYS = {
  interrupted: "threads.groupInterrupted",
  today: "threads.groupToday",
  yesterday: "threads.groupYesterday",
  week: "threads.groupWeek",
  older: "threads.groupOlder",
} as const;

const DATE_LOCALES: Record<Language, Locale> = {
  zh: zhCN,
  en: enUS,
};

// 状态点取主题里的状态色，五套主题各自定义，不再写死调色板类
const STATUS_COLORS: Record<ThreadItem["status"], string> = {
  idle: "bg-[var(--color-status-idle)]",
  busy: "bg-[var(--color-status-busy)]",
  interrupted: "bg-[var(--color-status-interrupted)]",
  error: "bg-[var(--color-status-error)]",
};

function getThreadColor(status: ThreadItem["status"]): string {
  return STATUS_COLORS[status] ?? "bg-[var(--color-text-tertiary)]";
}

// A module-level helper rather than a component, so it translates through the
// store instead of the `useI18n` hook.
function formatTime(date: Date, language: Language, now = new Date()): string {
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return format(date, "HH:mm");
  if (days === 1) return translate(language, "threads.yesterday");
  if (days < 7) return format(date, "EEEE", { locale: DATE_LOCALES[language] });
  return format(date, "MM/dd");
}

/**
 * 行主体（标题/时间/描述/状态点）。浏览模式与选择模式共用，
 * 两者的差别只在最外层容器是 `<button>` 还是 `<label>`。
 */
function ThreadRowBody({
  thread,
  language,
}: {
  thread: ThreadItem;
  language: Language;
}) {
  return (
    <div className="min-w-0 flex-1">
      {/* Title + Timestamp Row */}
      <div className="mb-1 flex items-center justify-between">
        <h3 className="truncate text-sm font-semibold">{thread.title}</h3>
        <span className="ml-2 flex-shrink-0 text-xs text-muted-foreground">
          {formatTime(thread.updatedAt, language)}
        </span>
      </div>
      {/* Description + Status Row */}
      <div className="flex items-center justify-between">
        <p className="flex-1 truncate text-sm text-muted-foreground">
          {thread.description}
        </p>
        <div className="ml-2 flex-shrink-0">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              getThreadColor(thread.status)
            )}
          />
        </div>
      </div>
    </div>
  );
}

function StatusFilterItem({
  status,
  label,
  badge,
}: {
  status: ThreadItem["status"];
  label: string;
  badge?: number;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          "inline-block size-2 rounded-full",
          getThreadColor(status)
        )}
      />
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 inline-flex items-center justify-center rounded-full bg-[var(--color-error)] px-1.5 py-0.5 text-xs font-bold leading-none text-white">
          {badge}
        </span>
      )}
    </span>
  );
}

function ErrorState({ message }: { message: string }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <p className="text-sm text-[var(--color-error)]">{t("threads.failedToLoad")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-16 w-full"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <MessageSquare className="mb-2 h-12 w-12 text-[var(--color-text-tertiary)]" />
      <p className="text-sm text-muted-foreground">{t("threads.empty")}</p>
    </div>
  );
}

interface ThreadListProps {
  onThreadSelect: (id: string) => void;
  onMutateReady?: (mutate: () => void) => void;
  onClose?: () => void;
  onInterruptCountChange?: (count: number) => void;
}

export function ThreadList({
  onThreadSelect,
  onMutateReady,
  onClose,
  onInterruptCountChange,
}: ThreadListProps) {
  const { language, t } = useI18n();
  const [currentThreadId, setThreadId] = useQueryState("threadId");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  /** 待确认删除的会话。null 表示弹窗关闭；长度为 1 即单条删除。 */
  const [threadsToDelete, setThreadsToDelete] = useState<ThreadItem[] | null>(
    null
  );
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const threads = useThreads({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 20,
  });

  const flattened = useMemo(() => {
    return threads.data?.flat() ?? [];
  }, [threads.data]);

  const isLoadingMore =
    threads.size > 0 && threads.data?.[threads.size - 1] == null;
  const isEmpty = threads.data?.at(0)?.length === 0;
  const isReachingEnd = isEmpty || (threads.data?.at(-1)?.length ?? 0) < 20;

  // Group threads by time and status
  const grouped = useMemo(() => {
    const now = new Date();
    const groups: Record<keyof typeof GROUP_LABEL_KEYS, ThreadItem[]> = {
      interrupted: [],
      today: [],
      yesterday: [],
      week: [],
      older: [],
    };

    flattened.forEach((thread) => {
      if (thread.status === "interrupted") {
        groups.interrupted.push(thread);
        return;
      }

      const diff = now.getTime() - thread.updatedAt.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) {
        groups.today.push(thread);
      } else if (days === 1) {
        groups.yesterday.push(thread);
      } else if (days < 7) {
        groups.week.push(thread);
      } else {
        groups.older.push(thread);
      }
    });

    return groups;
  }, [flattened]);

  const interruptedCount = useMemo(() => {
    return flattened.filter((t) => t.status === "interrupted").length;
  }, [flattened]);

  // 运行中的会话不参与批量删除：后端删掉它会连带中断正在跑的 run。
  // 单条删除的垃圾桶按钮刻意不设这个限制，留作卡死在 busy 的会话的兜底出口。
  const selectableThreads = useMemo(
    () => flattened.filter((thread) => thread.status !== "busy"),
    [flattened]
  );

  // 已选数量、全选态、删除载荷全部从当前列表派生，而不是直接读 selectedIds。
  // 这样已经不在列表里的 id（被别处删掉、或筛选后不可见）自动失效，
  // 不需要额外的清理 effect —— 切换筛选时 data 会短暂为空，那种按数据变化
  // 触发的清理反而会把选择误清干净。
  const selectedThreads = useMemo(
    () => flattened.filter((thread) => selectedIds.has(thread.id)),
    [flattened, selectedIds]
  );

  const selectedCount = selectedThreads.length;
  const allSelected =
    selectableThreads.length > 0 &&
    selectableThreads.every((thread) => selectedIds.has(thread.id));
  const someSelected =
    !allSelected &&
    selectableThreads.some((thread) => selectedIds.has(thread.id));

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllSelected = useCallback(() => {
    setSelectedIds((prev) =>
      allSelected ? new Set() : new Set(selectableThreads.map((t) => t.id))
    );
  }, [allSelected, selectableThreads]);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectMode = useCallback(() => {
    setIsSelectMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  // 选择模式下 Esc 退出。确认框打开时交给它自己处理，否则会连选择模式一起退掉。
  useEffect(() => {
    if (!isSelectMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || threadsToDelete) return;

      // 在聊天输入框里按 Esc 不该退出选择模式；焦点在复选框上时则应该退出，
      // 所以只放过文本输入类元素。
      const target = event.target as HTMLElement | null;
      if (target?.closest("textarea, [contenteditable='true']")) return;
      if (target instanceof HTMLInputElement && target.type !== "checkbox") {
        return;
      }

      exitSelectMode();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSelectMode, threadsToDelete, exitSelectMode]);

  // Expose thread list revalidation to parent component
  // Use refs to create a stable callback that always calls the latest mutate function
  const onMutateReadyRef = useRef(onMutateReady);
  const mutateRef = useRef(threads.mutate);

  useEffect(() => {
    onMutateReadyRef.current = onMutateReady;
  }, [onMutateReady]);

  useEffect(() => {
    mutateRef.current = threads.mutate;
  }, [threads.mutate]);

  const mutateFn = useCallback(() => {
    mutateRef.current();
  }, []);

  useEffect(() => {
    onMutateReadyRef.current?.(mutateFn);
    // Only run once on mount to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify parent of interrupt count changes
  useEffect(() => {
    onInterruptCountChange?.(interruptedCount);
  }, [interruptedCount, onInterruptCountChange]);

  const handleThreadsDeleted = ({ deleted, failed }: DeleteOutcome) => {
    // Clear the selection first: the chat would otherwise stay pointed at a
    // thread that no longer exists.
    if (deleted.some((thread) => thread.id === currentThreadId)) {
      setThreadId(null);
    }

    // 删除失败的留在选中态里，工具条上的删除按钮就是重试入口
    setSelectedIds(new Set(failed.map((failure) => failure.thread.id)));
    // 全部删干净才退出选择模式；有失败项就留在里面方便重试
    if (failed.length === 0) setIsSelectMode(false);

    threads.mutate();
  };

  const handleDeleteSelected = () => {
    // 快照当前选中项：删除期间 SWR 可能在后台刷新列表，
    // 载荷必须固定在用户点下删除的那一刻
    setThreadsToDelete(selectedThreads);
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Header with title, filter, and close button */}
      <div className="grid flex-shrink-0 grid-cols-[1fr_auto] items-center gap-3 border-b border-border p-4">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("threads.title")}
        </h2>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">{t("threads.allStatuses")}</SelectItem>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>{t("threads.groupActive")}</SelectLabel>
                <SelectItem value="idle">
                  <StatusFilterItem
                    status="idle"
                    label={t("threads.statusIdle")}
                  />
                </SelectItem>
                <SelectItem value="busy">
                  <StatusFilterItem
                    status="busy"
                    label={t("threads.statusBusy")}
                  />
                </SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>{t("threads.groupAttention")}</SelectLabel>
                <SelectItem value="interrupted">
                  <StatusFilterItem
                    status="interrupted"
                    label={t("threads.statusInterrupted")}
                    badge={interruptedCount}
                  />
                </SelectItem>
                <SelectItem value="error">
                  <StatusFilterItem
                    status="error"
                    label={t("threads.statusError")}
                  />
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSelectMode}
            disabled={flattened.length === 0}
            aria-pressed={isSelectMode}
            aria-label={
              isSelectMode
                ? t("threads.exitSelectMode")
                : t("threads.selectMode")
            }
            title={
              isSelectMode
                ? t("threads.exitSelectMode")
                : t("threads.selectMode")
            }
            className={cn(
              "h-8 w-8",
              isSelectMode && "bg-accent text-[var(--color-primary)]"
            )}
          >
            <ListChecks className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
              aria-label={t("threads.closeSidebar")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isSelectMode && (
        <ThreadBatchToolbar
          selectedCount={selectedCount}
          selectableCount={selectableThreads.length}
          allSelected={allSelected}
          someSelected={someSelected}
          onToggleAll={toggleAllSelected}
          onDelete={handleDeleteSelected}
          onExit={exitSelectMode}
        />
      )}

      <ScrollArea className="h-0 flex-1">
        {threads.error && <ErrorState message={threads.error.message} />}

        {!threads.error && !threads.data && threads.isLoading && (
          <LoadingState />
        )}

        {!threads.error && !threads.isLoading && isEmpty && <EmptyState />}

        {!threads.error && !isEmpty && (
          <div className="box-border w-full max-w-full overflow-hidden p-2">
            {(
              Object.keys(GROUP_LABEL_KEYS) as Array<
                keyof typeof GROUP_LABEL_KEYS
              >
            ).map((group) => {
              const groupThreads = grouped[group];
              if (groupThreads.length === 0) return null;

              return (
                <div
                  key={group}
                  className="mb-4"
                >
                  <h4 className="m-0 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(GROUP_LABEL_KEYS[group])}
                  </h4>
                  <div className="flex flex-col gap-1">
                    {groupThreads.map((thread) => {
                      const isCurrent = currentThreadId === thread.id;
                      const isSelected = selectedIds.has(thread.id);
                      const isSelectable = thread.status !== "busy";

                      return (
                        <div
                          key={thread.id}
                          className={cn(
                            "group relative rounded-lg border transition-colors duration-200",
                            // 选中态用主色淡底，跟「当前打开的会话」的 bg-accent
                            // 区分开，两者同时成立时以选中态呈现
                            isSelected
                              ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]"
                              : isCurrent
                              ? "border-[var(--color-primary)] bg-accent"
                              : "border-transparent hover:bg-accent"
                          )}
                        >
                          {isSelectMode ? (
                            // 选择模式整行是一个 label：点行内任意位置都会转发给
                            // checkbox，所以这里不需要挂 onClick，也就避开了
                            // button 套 input 的非法结构。此模式下不渲染垃圾桶，
                            // 它既没有意义也会跟整行点击抢事件。
                            <label
                              className={cn(
                                "flex w-full items-center gap-3 rounded-lg px-3 py-3",
                                isSelectable
                                  ? "cursor-pointer"
                                  : "cursor-not-allowed"
                              )}
                              title={
                                isSelectable
                                  ? undefined
                                  : t("threads.busyCannotDelete")
                              }
                            >
                              <Checkbox
                                checked={isSelected}
                                disabled={!isSelectable}
                                onCheckedChange={() =>
                                  toggleSelection(thread.id)
                                }
                                aria-label={t("threads.selectThread", {
                                  title: thread.title,
                                })}
                              />
                              <ThreadRowBody
                                thread={thread}
                                language={language}
                              />
                            </label>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => onThreadSelect(thread.id)}
                                className="grid w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left max-md:pr-12"
                                aria-current={isCurrent}
                              >
                                <ThreadRowBody
                                  thread={thread}
                                  language={language}
                                />
                              </button>
                              {/* Kept outside the select button: a nested button is
                                  invalid markup and would also trigger selection.
                                  Hidden until hover or keyboard focus, but always
                                  shown on narrow (touch) layouts, which have no
                                  hover — the row reserves space for it there. */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setThreadsToDelete([thread])}
                                aria-label={t("threads.delete")}
                                title={t("threads.delete")}
                                className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground opacity-100 transition-opacity hover:text-destructive md:bg-accent md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {!isReachingEnd && (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => threads.setSize(threads.size + 1)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("common.loading")}
                    </>
                  ) : (
                    t("threads.loadMore")
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <DeleteThreadDialog
        threads={threadsToDelete}
        onOpenChange={(open) => {
          if (!open) setThreadsToDelete(null);
        }}
        onDeleted={handleThreadsDeleted}
      />
    </div>
  );
}
