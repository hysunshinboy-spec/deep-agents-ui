"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_LANGUAGE,
  TranslationParams,
  getLanguage,
  initLanguage,
  setLanguage,
  subscribeLanguage,
  translate,
} from "@/lib/i18n";

/**
 * The translator. Safe to call from any component, including ones wrapped in
 * `React.memo`: the subscription lives inside the hook, so a language change
 * re-renders the subscriber regardless of its props.
 */
export function useI18n() {
  const language = useSyncExternalStore(
    subscribeLanguage,
    getLanguage,
    () => DEFAULT_LANGUAGE
  );

  const t = useCallback(
    (key: string, params?: TranslationParams) =>
      translate(language, key, params),
    [language]
  );

  return useMemo(() => ({ language, setLanguage, t }), [language, t]);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { language } = useI18n();

  // Read the stored preference after mount so the server-rendered markup and
  // the first client render both use the default language.
  useEffect(() => {
    initLanguage();
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  return <>{children}</>;
}
