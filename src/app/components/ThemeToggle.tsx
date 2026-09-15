"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { THEMES, ThemeId } from "@/lib/theme";
import { useI18n } from "@/providers/I18nProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";

/** 色板圆点用的主色，与 globals.css 里各主题的 --color-primary 一一对应。 */
const THEME_SWATCHES: Record<ThemeId, string> = {
  teal: "#1c3c3c",
  blue: "#1d4ed8",
  mint: "#0f9d76",
  violet: "#a78bfa",
  sand: "#cf6b34",
};

function ThemeLabel({ id, label }: { id: ThemeId; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block size-2.5 rounded-full ring-1 ring-inset ring-black/10"
        style={{ backgroundColor: THEME_SWATCHES[id] }}
      />
      {label}
    </span>
  );
}

/**
 * 主题选择。5 套主题用循环点击不好辨认，所以用下拉；触发器的字号与间距
 * 对齐 header 里其它 size="sm" 的按钮。
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  return (
    <Select
      value={theme}
      onValueChange={(value) => setTheme(value as ThemeId)}
    >
      <SelectTrigger
        className={cn("h-8 w-fit gap-2 text-sm", className)}
        aria-label={t("theme.switch")}
        title={t("theme.switch")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {THEMES.map((item) => (
          <SelectItem
            key={item.id}
            value={item.id}
          >
            <ThemeLabel
              id={item.id}
              label={t(item.labelKey)}
            />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
