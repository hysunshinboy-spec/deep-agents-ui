"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANGUAGE_LABELS, Language } from "@/lib/i18n";
import { useI18n } from "@/providers/I18nProvider";
import { cn } from "@/lib/utils";

const LANGUAGES: Language[] = ["zh", "en"];

/**
 * Two labels side by side with the active one emphasised, so the current
 * language is readable at a glance and either one is a single click away.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
      aria-label={t("language.switch")}
      title={t("language.switch")}
      className={className}
    >
      <Languages className="mr-2 h-4 w-4" />
      {LANGUAGES.map((value, index) => (
        <span
          key={value}
          className="flex items-center"
        >
          {index > 0 && <span className="mx-1 text-muted-foreground">/</span>}
          <span
            className={cn(
              language === value
                ? "font-semibold text-foreground"
                : "text-muted-foreground"
            )}
          >
            {LANGUAGE_LABELS[value]}
          </span>
        </span>
      ))}
    </Button>
  );
}
