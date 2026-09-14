"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { ThreadItem } from "@/app/hooks/useThreads";
import { toast } from "sonner";

interface DeleteThreadDialogProps {
  /** The thread awaiting confirmation. A null value keeps the dialog closed. */
  thread: ThreadItem | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (thread: ThreadItem) => void;
}

export function DeleteThreadDialog({
  thread,
  onOpenChange,
  onDeleted,
}: DeleteThreadDialogProps) {
  const client = useClient();
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!thread) return;

    setIsDeleting(true);
    try {
      await client.threads.delete(thread.id);
      toast.success(t("threads.deleted"));
      onDeleted(thread);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t("threads.deleteFailed", { error: message }));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={thread !== null}
      // Ignore dismissals while the request is in flight so the dialog cannot
      // disappear before the outcome is known.
      onOpenChange={(open) => {
        if (!isDeleting) onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("threads.deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("threads.deleteDescription", { title: thread?.title ?? "" })}
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
            {isDeleting ? t("threads.deleting") : t("threads.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
