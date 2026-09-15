"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { format, type Locale } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { Loader2, MessageSquare, Trash2, X } from "lucide-react";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
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
import { DeleteThreadDialog } from "@/app/components/DeleteThreadDialog";

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
  const [threadToDelete, setThreadToDelete] = useState<ThreadItem | null>(null);

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

  const handleThreadDeleted = (thread: ThreadItem) => {
    // Clear the selection first: the chat would otherwise stay pointed at a
    // thread that no longer exists.
    if (currentThreadId === thread.id) {
      setThreadId(null);
    }
    threads.mutate();
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
                    {groupThreads.map((thread) => (
                      <div
                        key={thread.id}
                        className={cn(
                          "group relative rounded-lg border transition-colors duration-200",
                          currentThreadId === thread.id
                            ? "border-[var(--color-primary)] bg-accent"
                            : "border-transparent hover:bg-accent"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onThreadSelect(thread.id)}
                          className="grid w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left max-md:pr-12"
                          aria-current={currentThreadId === thread.id}
                        >
                          <div className="min-w-0 flex-1">
                            {/* Title + Timestamp Row */}
                            <div className="mb-1 flex items-center justify-between">
                              <h3 className="truncate text-sm font-semibold">
                                {thread.title}
                              </h3>
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
                        </button>
                        {/* Kept outside the select button: a nested button is
                            invalid markup and would also trigger selection.
                            Hidden until hover or keyboard focus, but always
                            shown on narrow (touch) layouts, which have no
                            hover — the row reserves space for it there. */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setThreadToDelete(thread)}
                          aria-label={t("threads.delete")}
                          title={t("threads.delete")}
                          className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground opacity-100 transition-opacity hover:text-destructive md:bg-accent md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
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
        thread={threadToDelete}
        onOpenChange={(open) => {
          if (!open) setThreadToDelete(null);
        }}
        onDeleted={handleThreadDeleted}
      />
    </div>
  );
}
