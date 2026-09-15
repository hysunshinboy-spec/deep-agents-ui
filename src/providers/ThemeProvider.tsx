"use client";

import React, { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  DEFAULT_THEME,
  THEME_ATTRIBUTE,
  ThemeId,
  getTheme,
  initTheme,
  setTheme,
  subscribeTheme,
} from "@/lib/theme";

/**
 * 主题读取。与 useI18n 同样把订阅放在 hook 内部，套在 React.memo 里的组件
 * 也能随主题变化重渲染。
 */
export function useTheme() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getTheme,
    () => DEFAULT_THEME
  );

  return useMemo(
    () => ({ theme, setTheme: (next: ThemeId) => setTheme(next) }),
    [theme]
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  // 挂载后再读存储，保证服务端输出与首帧一致。
  useEffect(() => {
    initTheme();
  }, []);

  // 把主题挂到 <html> 上，CSS 侧的 :root[data-theme="…"] 才会命中。
  // 防闪脚本会先写一次，这里负责后续切换。
  useEffect(() => {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  }, [theme]);

  return <>{children}</>;
}
