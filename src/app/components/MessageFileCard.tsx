"use client";

import React, { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, FileIcon } from "lucide-react";
import { CopyButton } from "@/app/components/CopyButton";
import { cn } from "@/lib/utils";

interface MessageFileCardProps {
  name: string;
  content: string;
  className?: string;
  /** 内容超过这个长度时默认折叠，避免长文件一下占满屏幕。 */
  collapseThreshold?: number;
}

/**
 * 聊天消息里的文件卡片：头部是文件名 + 复制按钮，点击头部展开/收起正文。
 * 用户上传的附件和 agent 生成的文件（write_file/edit_file）都用它展示，
 * 统一放在消息正文下方。
 */
export const MessageFileCard = React.memo<MessageFileCardProps>(
  ({ name, content, className, collapseThreshold = 2000 }) => {
    const [expanded, setExpanded] = useState(
      () => content.length <= collapseThreshold
    );
    const toggle = useCallback(() => setExpanded((prev) => !prev), []);

    return (
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-border bg-muted/30",
          className
        )}
      >
        <div className="flex items-center gap-1 pl-1 pr-2">
          <button
            type="button"
            onClick={toggle}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-1 py-1.5 text-left"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown
                size={14}
                className="shrink-0 text-muted-foreground"
              />
            ) : (
              <ChevronRight
                size={14}
                className="shrink-0 text-muted-foreground"
              />
            )}
            <FileIcon
              size={14}
              className="shrink-0 text-muted-foreground"
            />
            <span className="truncate font-mono text-xs text-foreground">
              {name}
            </span>
          </button>
          <CopyButton
            text={content}
            size={13}
          />
        </div>
        {expanded && (
          <pre className="m-0 max-h-80 overflow-y-auto border-t border-border bg-muted/20 p-2 font-mono text-xs leading-6 text-foreground">
            {content}
          </pre>
        )}
      </div>
    );
  }
);

MessageFileCard.displayName = "MessageFileCard";
