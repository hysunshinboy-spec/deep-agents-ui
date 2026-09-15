import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { CSSProperties } from "react";

/**
 * 代码高亮的配色表。
 *
 * react-syntax-highlighter 把这份样式表当内联样式用（useInlineStyles 默认为 true），
 * 而内联样式里的 var() 是能解析的，所以这里不需要按主题分支：以 oneDark 为底，把
 * 颜色换成 --color-code-* 与 --color-selection-*，五套主题各自的取值写在 globals.css。
 * 非颜色属性（字体、缩进、换行、行号）全部保留 oneDark 原值。
 */

type CodeStyles = { [key: string]: CSSProperties };

/** oneDark 里同一个颜色散落在多个 token 上，这里按颜色归组，避免重复。 */
const TOKEN_COLOR_VARS: [string[], string][] = [
  [["comment", "prolog", "cdata"], "var(--color-code-comment)"],
  [["doctype", "punctuation", "entity"], "var(--color-code-punctuation)"],
  [
    ["attr-name", "class-name", "boolean", "constant", "number", "atrule"],
    "var(--color-code-number)",
  ],
  [["keyword"], "var(--color-code-keyword)"],
  [["property", "tag", "symbol", "deleted", "important"], "var(--color-code-tag)"],
  [
    ["selector", "string", "char", "builtin", "inserted", "regex", "attr-value"],
    "var(--color-code-string)",
  ],
  [["variable", "operator", "function"], "var(--color-code-function)"],
  [["url"], "var(--color-code-url)"],
];

/** 容器：底色、正文色、文字阴影；其余沿用 oneDark。 */
const CONTAINER_SELECTORS = [
  'code[class*="language-"]',
  'pre[class*="language-"]',
];

/** oneDark 的选区是一块深灰，在浅色底上很扎眼，换成主题的选区色。 */
const SELECTION_SELECTORS = [
  'code[class*="language-"]::-moz-selection',
  'code[class*="language-"] *::-moz-selection',
  'pre[class*="language-"] *::-moz-selection',
  'code[class*="language-"]::selection',
  'code[class*="language-"] *::selection',
  'pre[class*="language-"] *::selection',
];

function buildCodeTheme(): CodeStyles {
  const styles: CodeStyles = { ...oneDark };

  for (const selector of CONTAINER_SELECTORS) {
    styles[selector] = {
      ...styles[selector],
      background: "var(--color-code-bg)",
      color: "var(--color-code-text)",
      textShadow: "none",
    };
  }

  for (const [tokens, color] of TOKEN_COLOR_VARS) {
    for (const token of tokens) {
      styles[token] = { ...styles[token], color };
    }
  }

  for (const selector of SELECTION_SELECTORS) {
    styles[selector] = {
      ...styles[selector],
      background: "var(--color-selection-bg)",
      color: "var(--color-selection-text)",
    };
  }

  // FileViewDialog 开了 showLineNumbers，行号在浅色底上也要看得清
  styles[".line-numbers.line-numbers .line-numbers-rows"] = {
    ...styles[".line-numbers.line-numbers .line-numbers-rows"],
    borderRightColor: "var(--color-border)",
  };
  styles[".line-numbers .line-numbers-rows > span:before"] = {
    ...styles[".line-numbers .line-numbers-rows > span:before"],
    color: "var(--color-text-tertiary)",
  };

  return styles;
}

export const codeTheme = buildCodeTheme();
