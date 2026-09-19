export type ThemeId = "teal" | "sky" | "peach";

export interface ThemeMeta {
  id: ThemeId;
  /** 主题名走翻译表，随语言切换。 */
  labelKey: string;
  /** 暗色主题，供选择器区分明暗。 */
  isDark: boolean;
}

/** 顺序即选择器里的展示顺序。 */
export const THEMES: ThemeMeta[] = [
  { id: "teal", labelKey: "theme.teal", isDark: false },
  { id: "sky", labelKey: "theme.sky", isDark: false },
  { id: "peach", labelKey: "theme.peach", isDark: false },
];

/** 默认青绿：未选择过主题的用户看到的仍是改造前的那套配色。 */
export const DEFAULT_THEME: ThemeId = "teal";

/** 跨刷新记住选择。layout.tsx 的防闪脚本会用同一个键去读，改这里就够。 */
export const THEME_STORAGE_KEY = "deep-agent-theme";

/** 主题写到 <html> 上的属性名，CSS 里以 :root[data-theme="…"] 匹配。 */
export const THEME_ATTRIBUTE = "data-theme";

function isTheme(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

/*
 * 与 i18n 相同的模块级 store：状态放在 React 之外，这样非组件调用方也能读，
 * 组件通过 useTheme 里的 useSyncExternalStore 订阅。
 */
let currentTheme: ThemeId = DEFAULT_THEME;
const listeners = new Set<() => void>();

export function getTheme(): ThemeId {
  return currentTheme;
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function setTheme(theme: ThemeId): void {
  if (!isTheme(theme) || theme === currentTheme) return;
  currentTheme = theme;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // 隐私模式或存储被禁用：保留内存里的选择。
    }
  }

  emit();
}

/**
 * 读取上次的选择。只在挂载后调用（不在 SSR 期间），这样服务端与首次客户端渲染
 * 都是默认主题，水合不会报错。
 */
export function initTheme(): void {
  if (typeof window === "undefined") return;

  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // 存储读不到就保持默认。
  }

  if (isTheme(stored) && stored !== currentTheme) {
    currentTheme = stored;
    emit();
  }
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
