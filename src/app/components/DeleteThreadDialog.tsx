"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Client } from "@langchain/langgraph-sdk";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useClient } from "@/providers/ClientProvider";
import { useI18n } from "@/providers/I18nProvider";
import { getHttpStatus } from "@/lib/assistants";
import type { ThreadItem } from "@/app/hooks/useThreads";
import { toast } from "sonner";

/**
 * 删除并发上限。不用 Promise.allSettled 一次全展开：全选几十上百条时会一次性
 * 打出同样数量的请求，挤满浏览器连接池、也让服务端瞬时受压，中途还拿不到进度。
 * 串行则太慢，对话框里除了一颗转圈什么都没有，用户会以为卡死。
 */
const DELETE_CONCURRENCY = 4;

/** 反复重试时复用同一条 toast，避免堆叠出一串。 */
const TOAST_ID = "threads-delete";

interface DeleteFailure {
  thread: ThreadItem;
  message: string;
}

export interface DeleteOutcome {
  deleted: ThreadItem[];
  failed: DeleteFailure[];
}

/**
 * 有界并发删除，工作池大小固定为 DELETE_CONCURRENCY。
 */
async function deleteThreads(
  client: Client,
  targets: ThreadItem[],
  onProgress: (done: number, total: number) => void
): Promise<DeleteOutcome> {
  const deleted: ThreadItem[] = [];
  const failed: DeleteFailure[] = [];
  let cursor = 0;
  let done = 0;

  // 各 worker 共用一个游标自行取任务，谁空谁取。cursor++ 与读取之间没有 await，
  // 所以并发下不会取到同一条。
  const worker = async () => {
    while (cursor < targets.length) {
      const thread = targets[cursor++];
      try {
        await client.threads.delete(thread.id);
        deleted.push(thread);
      } catch (error) {
        // 404 说明服务端已经没有这条会话了（比如另一个标签页刚删过），
        // 结果和删除成功一致，不该当成失败打扰用户
        if (getHttpStatus(error) === 404) {
          deleted.push(thread);
        } else {
          failed.push({
            thread,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        done += 1;
        onProgress(done, targets.length);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(DELETE_CONCURRENCY, targets.length) }, worker)
  );

  return { deleted, failed };
}

interface DeleteThreadDialogProps {
  /**
   * 待删除的会话。null 或空数组都表示关闭弹窗。单条删除传 `[thread]`，
   * 批量删除传用户点下确认那一刻的选中快照。
   */
  threads: ThreadItem[] | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (outcome: DeleteOutcome) => void;
}

export function DeleteThreadDialog({
  threads,
  onOpenChange,
  onDeleted,
}: DeleteThreadDialogProps) {
  const client = useClient();
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const targets = threads ?? [];
  const isBatch = targets.length > 1;

  const handleDelete = async () => {
    if (targets.length === 0) return;

    setIsDeleting(true);
    setProgress({ done: 0, total: targets.length });

    const { deleted, failed } = await deleteThreads(
      client,
      targets,
      (done, total) => setProgress({ done, total })
    );

    if (failed.length === 0) {
      toast.success(
        isBatch
          ? t("threads.batchDeleted", { count: deleted.length })
          : t("threads.deleted"),
        { id: TOAST_ID }
      );
    } else if (deleted.length === 0) {
      // 全部失败时把首个错误直接摊在 toast 里，用户不用去翻控制台
      toast.error(
        isBatch
          ? t("threads.batchDeleteAllFailed", { count: failed.length })
          : t("threads.deleteFailed", { error: failed[0].message }),
        { id: TOAST_ID, description: isBatch ? failed[0].message : undefined }
      );
    } else {
      toast.warning(
        t("threads.batchDeletePartial", {
          success: deleted.length,
          failed: failed.length,
        }),
        {
          id: TOAST_ID,
          description: t("threads.batchDeletePartialDescription", {
            error: failed[0].message,
          }),
        }
      );
    }

    // 全部失败时保持打开，用户可以直接重试；有成功项才关闭
    if (deleted.length > 0) {
      onDeleted({ deleted, failed });
      onOpenChange(false);
    }

    setIsDeleting(false);
  };

  return (
    <Dialog
      open={targets.length > 0}
      // Ignore dismissals while the request is in flight so the dialog cannot
      // disappear before the outcome is known.
      onOpenChange={(open) => {
        if (!isDeleting) onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isBatch
              ? t("threads.deleteSelectedTitle", { count: targets.length })
              : t("threads.deleteTitle")}
          </DialogTitle>
          <DialogDescription>
            {isBatch
              ? t("threads.deleteSelectedDescription", {
                  count: targets.length,
                })
              : t("threads.deleteDescription", {
                  title: targets[0]?.title ?? "",
                })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {isDeleting
              ? isBatch
                ? t("threads.deletingProgress", {
                    done: progress.done,
                    total: progress.total,
                  })
                : t("threads.deleting")
              : isBatch
              ? t("threads.deleteSelected")
              : t("threads.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
