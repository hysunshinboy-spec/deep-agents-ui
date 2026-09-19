"use client";

import React, { useCallback, useState } from "react";
import {
  FileText,
  FileCode2,
  File,
  Table2,
  Brain,
  Check,
  Loader2,
} from "lucide-react";
import type { FileItem, FileData, TodoItem } from "@/app/types/types";
import { useChatContext } from "@/providers/ChatProvider";
import { useI18n } from "@/providers/I18nProvider";
import { cn } from "@/lib/utils";
import { FileViewDialog } from "@/app/components/FileViewDialog";

/**
 * 右侧面板：产物（虚拟文件系统里的生成文件）+ 任务进度（todo 清单）。
 * 视觉参考 sketches/006-light-cream：小字距大写的分区标题、文件行图标 +
 * 元信息（字数 · 时间）、任务项做勾选框样式。
 */

/**
 * 取出一个文件条目的纯文本。
 *
 * `FileData.content` 在类型上是字符串，但历史状态里可能残留 `string[]` 形式的
 * 旧值（后端 `file_data_to_string` 同样在兼容它），所以这里仍做一次归一化。
 */
function fileDataToText(raw: FileData | undefined): string {
  if (!raw) return "";
  const content = raw.content as unknown;
  if (Array.isArray(content)) return content.join("\n");
  return String(content ?? "");
}

/** 内容里带 markmap 代码块的 .md 视为思维导图产物，图标和徽标单独处理。 */
function isMarkmapFile(path: string, content: string): boolean {
  return path.endsWith(".md") && content.includes("```markmap");
}

/** 按扩展名选图标；markmap 优先。 */
function fileIcon(path: string, content: string) {
  if (isMarkmapFile(path, content)) return Brain;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "md":
    case "txt":
      return FileText;
    case "csv":
    case "tsv":
      return Table2;
    case "json":
    case "html":
    case "htm":
    case "py":
    case "js":
    case "ts":
    case "tsx":
    case "yaml":
    case "yml":
    case "xml":
      return FileCode2;
    default:
      return File;
  }
}

/** 字数紧凑格式：3100 → "3.1k"。 */
function compactChars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function ArtifactsPanel() {
  const { t } = useI18n();
  const { todos, files, setFiles, isLoading, interrupt } = useChatContext();
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);

  const handleSaveFile = useCallback(
    async (fileName: string, content: string) => {
      // `setFiles` 的通道 reducer 是按键合并的，所以只提交这一个条目即可，
      // 不必把整张表回传。
      const now = new Date().toISOString();
      await setFiles({
        [fileName]: {
          content,
          encoding: "utf-8",
          created_at: files[fileName]?.created_at ?? now,
          modified_at: now,
        },
      });
      setSelectedFile({ path: fileName, content: content });
    },
    [files, setFiles]
  );

  const relativeTime = useCallback(
    (iso: string | undefined): string => {
      if (!iso) return "";
      const then = new Date(iso).getTime();
      if (Number.isNaN(then)) return "";
      const minutes = Math.floor((Date.now() - then) / 60000);
      if (minutes < 1) return t("time.justNow");
      if (minutes < 60) return t("time.minutesAgo", { n: minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t("time.hoursAgo", { n: hours });
      return t("time.daysAgo", { n: Math.floor(hours / 24) });
    },
    [t]
  );

  const fileNames = Object.keys(files);

  return (
    <div
      data-panel-id="artifacts"
      className="flex h-full min-h-0 flex-col"
    >
      {/* ── 产物 ── */}
      <div className="flex-none border-b border-border px-4 pb-2 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
        {t("panel.artifacts")} · {fileNames.length}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {fileNames.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
            {t("files.empty")}
          </p>
        ) : (
          fileNames.map((path) => {
            const content = fileDataToText(files[path]);
            const markmap = isMarkmapFile(path, content);
            const Icon = fileIcon(path, content);
            const meta = [
              t("files.chars", { count: compactChars(content.length) }),
              markmap ? "markmap" : relativeTime(files[path]?.modified_at),
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={path}
                type="button"
                onClick={() => {
                  setActivePath(path);
                  setSelectedFile({ path, content });
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 border-b border-[var(--color-border-light)] px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-file-button-hover)]",
                  activePath === path &&
                    "bg-[var(--color-file-button)] shadow-[inset_2px_0_0_var(--color-accent-strong)]"
                )}
              >
                <span className="flex size-7 flex-none items-center justify-center rounded-[9px] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
                  <Icon size={14} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] leading-snug text-foreground">
                    {path}
                  </span>
                  <span className="block truncate font-mono text-[10px] leading-snug text-[var(--color-text-tertiary)]">
                    {meta}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* ── 任务进度 ── */}
      <div className="flex-none border-t border-border px-4 pb-2 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
        {t("panel.progress")}
      </div>
      <div className="max-h-[45%] flex-none overflow-y-auto px-4 pb-3">
        {todos.length === 0 ? (
          <p className="py-4 text-center text-xs text-[var(--color-text-tertiary)]">
            {t("tasks.empty")}
          </p>
        ) : (
          todos.map((todo, index) => (
            <TaskRow
              key={`${todo.id}_${index}`}
              todo={todo}
            />
          ))
        )}
      </div>

      {selectedFile && (
        <FileViewDialog
          file={selectedFile}
          onSaveFile={handleSaveFile}
          onClose={() => setSelectedFile(null)}
          editDisabled={isLoading === true || interrupt !== undefined}
        />
      )}
    </div>
  );
}

/** 单个任务行：勾选框 + 文案，completed 划线、in_progress 高亮。 */
function TaskRow({ todo }: { todo: TodoItem }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 py-1.5 text-[13px] leading-relaxed",
        todo.status === "completed" &&
          "text-[var(--color-text-tertiary)] line-through",
        todo.status === "in_progress" && "text-foreground"
      )}
    >
      <span
        className={cn(
          "mt-[3px] flex size-[15px] flex-none items-center justify-center rounded-[5px] border",
          todo.status === "completed" &&
            "border-transparent bg-[var(--color-success)]/15 text-[var(--color-success)]",
          todo.status === "in_progress" &&
            "border-[var(--color-accent-strong)] text-[var(--color-accent-strong)]",
          todo.status === "pending" &&
            "border-[var(--color-border)] bg-[var(--color-file-button)] text-transparent"
        )}
      >
        {todo.status === "completed" ? (
          <Check size={10} />
        ) : todo.status === "in_progress" ? (
          <Loader2
            size={9}
            className="animate-spin"
          />
        ) : null}
      </span>
      <span className="flex-1 break-words">{todo.content}</span>
    </div>
  );
}
