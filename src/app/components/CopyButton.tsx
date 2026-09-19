"use client";

import React, { useCallback, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/I18nProvider";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  className?: string;
  /** 图标尺寸，默认 14。 */
  size?: number;
}

/**
 * 通用的「复制到剪贴板」小按钮：点击后短暂显示对勾反馈。
 * 用于消息正文、文件卡片等处的复制入口。
 */
export const CopyButton = React.memo<CopyButtonProps>(
  ({ text, className, size = 14 }) => {
    const { t } = useI18n();
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleCopy = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // 剪贴板 API 在部分环境（非安全上下文等）不可用，静默失败即可。
        return;
      }
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    }, [text]);

    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        title={copied ? t("chat.copied") : t("chat.copy")}
        aria-label={copied ? t("chat.copied") : t("chat.copy")}
        className={cn("h-6 w-6 text-[var(--color-text-tertiary)]", className)}
      >
        {copied ? (
          <Check
            size={size}
            className="text-[var(--color-success)]"
          />
        ) : (
          <Copy size={size} />
        )}
      </Button>
    );
  }
);

CopyButton.displayName = "CopyButton";
