"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { codeTheme } from "@/lib/codeTheme";
import { MarkmapOutline } from "@/app/components/MarkmapOutline";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
  /**
   * 为 false 表示内容仍在流式增长（所属消息还没输出完）。此时 markmap
   * 代码块用轻量占位代替交互式脑图：否则流式期间每来一个 token 都会触发
   * 整图 transform + 布局 + 动画重建，多个 rAF 周期堆叠会把主线程压满，
   * 页面直接失去响应。输出完成后才一次性挂载渲染。
   */
  streamFinished?: boolean;
}

export const MarkdownContent = React.memo<MarkdownContentProps>(
  ({ content, className = "", streamFinished = true }) => {
    return (
      <div
        className={cn(
          "prose min-w-0 max-w-full overflow-hidden break-words text-sm leading-relaxed text-inherit [&_h1:first-child]:mt-0 [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:font-semibold [&_h2:first-child]:mt-0 [&_h2]:mb-4 [&_h2]:mt-6 [&_h2]:font-semibold [&_h3:first-child]:mt-0 [&_h3]:mb-4 [&_h3]:mt-6 [&_h3]:font-semibold [&_h4:first-child]:mt-0 [&_h4]:mb-4 [&_h4]:mt-6 [&_h4]:font-semibold [&_h5:first-child]:mt-0 [&_h5]:mb-4 [&_h5]:mt-6 [&_h5]:font-semibold [&_h6:first-child]:mt-0 [&_h6]:mb-4 [&_h6]:mt-6 [&_h6]:font-semibold [&_p:last-child]:mb-0 [&_p]:mb-4",
          className
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({
              inline,
              className,
              children,
              ...props
            }: {
              inline?: boolean;
              className?: string;
              children?: React.ReactNode;
            }) {
              const match = /language-(\w+)/.exec(className || "");
              // 思维导图代码块：交给 markmap 渲染成交互式 SVG，不走语法高亮
              if (!inline && match?.[1] === "markmap") {
                const md = String(children).replace(/\n$/, "");
                // 流式输出期间先用纯文本占位，完成后再挂载脑图（见 props 说明）
                if (!streamFinished) {
                  return (
                    <pre className="bg-surface my-4 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border p-3 font-mono text-xs last:mb-0">
                      {md}
                    </pre>
                  );
                }
                return <MarkmapOutline markdown={md} />;
              }
              return !inline && match ? (
                <SyntaxHighlighter
                  style={codeTheme}
                  language={match[1]}
                  PreTag="div"
                  className="max-w-full rounded-md text-sm"
                  wrapLines={true}
                  wrapLongLines={true}
                  lineProps={{
                    style: {
                      wordBreak: "break-all",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "break-word",
                    },
                  }}
                  customStyle={{
                    margin: 0,
                    maxWidth: "100%",
                    overflowX: "auto",
                    fontSize: "0.875rem",
                  }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              ) : (
                <code
                  className="rounded-sm bg-[var(--color-surface)] px-1 py-0.5 font-mono text-[0.9em]"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            pre({ children }: { children?: React.ReactNode }) {
              return (
                <div className="my-4 max-w-full overflow-hidden last:mb-0">
                  {children}
                </div>
              );
            },
            a({
              href,
              children,
            }: {
              href?: string;
              children?: React.ReactNode;
            }) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-primary)] no-underline hover:underline"
                >
                  {children}
                </a>
              );
            },
            blockquote({ children }: { children?: React.ReactNode }) {
              return (
                <blockquote className="my-4 border-l-4 border-border pl-4 italic text-[var(--color-text-secondary)]">
                  {children}
                </blockquote>
              );
            },
            ul({ children }: { children?: React.ReactNode }) {
              return (
                <ul className="my-4 pl-6 [&>li:last-child]:mb-0 [&>li]:mb-1">
                  {children}
                </ul>
              );
            },
            ol({ children }: { children?: React.ReactNode }) {
              return (
                <ol className="my-4 pl-6 [&>li:last-child]:mb-0 [&>li]:mb-1">
                  {children}
                </ol>
              );
            },
            table({ children }: { children?: React.ReactNode }) {
              return (
                <div className="my-4 overflow-x-auto">
                  <table className="w-full border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:bg-[var(--color-surface)] [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold">
                    {children}
                  </table>
                </div>
              );
            },
            // 图表服务返回的位图是宽图，不加约束会撑破聊天气泡
            img({ src, alt }: { src?: string | Blob; alt?: string }) {
              return (
                <img
                  src={typeof src === "string" ? src : undefined}
                  alt={alt || ""}
                  className="my-4 h-auto max-w-full rounded-md last:mb-0"
                />
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }
);

MarkdownContent.displayName = "MarkdownContent";
