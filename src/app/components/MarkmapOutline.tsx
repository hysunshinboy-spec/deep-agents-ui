"use client";

import React, { useEffect, useRef, useState } from "react";
import { Transformer } from "markmap-lib/no-plugins";
import { Markmap, deriveOptions } from "markmap-view";
import { Toolbar } from "markmap-toolbar";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import "markmap-toolbar/dist/style.css";

/**
 * 思维导图渲染组件：模型输出 ```markmap 代码块（Markdown 大纲）时，
 * 由 MarkdownContent 的 code 组件路由到这里，在浏览器本地渲染成
 * 可折叠/可缩放的 SVG 脑图。零服务、零外网请求，内容不出网。
 *
 * 安全前提：markmap-lib 内部 markdown-it 写死 html:true，节点里的原始
 * HTML 会进 DOM 并执行（实测 <img onerror> 可触发），而内容可能来自联网
 * 搜索结果。所以 transform 前必须先剥掉 HTML（保留文本与 Markdown 语法），
 * 实测剥掉后注入失效，**加粗**、`代码`均保留。
 */

// 先整块丢掉 script/style 的内容，再剥其余标签但保留文本。
// `<https://...>` 自动链接会退化成纯文本，可接受。
function sanitize(markdown: string): string {
  return markdown
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, "");
}

// 复用同一个 Transformer 实例即可，它是无状态的解析器
const transformer = new Transformer();

// 只在 svg 仍挂在文档上时 fit。组件卸载后 markmap 残留的异步回调
// （内部 ResizeObserver 的 debounce、进行中的 transition）可能再次触发
// fit/zoom，此时 svg 已脱离文档，防御性跳过
function safeFit(mm: Markmap, svgEl: SVGSVGElement) {
  if (!svgEl.isConnected) return;
  try {
    mm.fit();
  } catch {
    /* 忽略卸载竞态中的瞬时异常 */
  }
}

export function MarkmapOutline({ markdown }: { markdown: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const mmRef = useRef<Markmap | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // 现有主题（teal/sky/peach）全是浅色，脑图始终用浅色渲染；
  // 未来若新增暗色主题，再在这里接 useTheme 判断
  const isDark = false;

  useEffect(() => {
    const svgEl = svgRef.current;
    const boxEl = boxRef.current;
    if (!svgEl || !boxEl) return;

    const { root } = transformer.transform(sanitize(markdown));
    // 先写入显式像素尺寸属性，再创建 markmap。svg 没有 width/height 属性时，
    // d3-zoom 的 defaultExtent 读到的 width/height.baseVal 是相对单位；组件卸载后
    // svg 脱离文档，残留的 fit/zoom 回调再读 .value 会抛 NotSupportedError
    // "Could not resolve relative length"，错误冒泡到 window 直接打崩页面。
    // 属性为绝对单位后任何状态下都安全；视觉尺寸仍由 CSS h-full w-full 决定，
    // 这里的属性值只被 d3 读取，不影响布局
    const syncSize = () => {
      const { width, height } = boxEl.getBoundingClientRect();
      if (width > 0 && height > 0) {
        svgEl.setAttribute("width", String(Math.round(width)));
        svgEl.setAttribute("height", String(Math.round(height)));
      }
    };
    syncSize();

    // no-plugins 模式下 getUsedAssets 通常为空，不必走 loadCSS/loadJS
    const mm = Markmap.create(
      svgEl,
      deriveOptions({ colorFreezeLevel: 2, spacingVertical: 8 }),
      root
    );
    mmRef.current = mm;
    safeFit(mm, svgEl);

    const toolbar = new Toolbar();
    toolbar.attach(mm);
    const toolbarEl = toolbar.render();
    toolbarEl.style.position = "absolute";
    toolbarEl.style.bottom = "8px";
    toolbarEl.style.right = "8px";
    boxEl.append(toolbarEl);

    // 容器尺寸变化（窗口拉伸、进入全屏）后同步尺寸属性并重新适配，
    // 否则缩放比例是旧的
    const observer = new ResizeObserver(() => {
      syncSize();
      safeFit(mm, svgEl);
    });
    observer.observe(boxEl);

    return () => {
      observer.disconnect();
      toolbarEl.remove();
      mmRef.current = null;
      // markmap 0.18 起提供 destroy：移除 zoom 监听并断开内部 ResizeObserver，
      // 防止卸载后残留回调继续在旧 svg 上跑
      mm.destroy();
    };
    // 只在挂载时创建一次；markdown 的增量更新由下面的 setData effect 负责
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 流式输出过程中 markdown 会增量变化：复用实例 setData，不要重建
  useEffect(() => {
    const mm = mmRef.current;
    const svgEl = svgRef.current;
    if (!mm || !svgEl) return;
    mm.setData(transformer.transform(sanitize(markdown)).root);
    safeFit(mm, svgEl);
  }, [markdown]);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md border border-border bg-background",
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none"
          : "my-4 h-[520px] last:mb-0"
      )}
    >
      <div
        ref={boxRef}
        className={cn("absolute inset-0", isDark && "markmap-dark")}
      >
        <svg
          ref={svgRef}
          className="h-full w-full"
        />
      </div>
      <button
        type="button"
        onClick={() => setIsFullscreen((v) => !v)}
        title={isFullscreen ? "退出全屏" : "全屏查看"}
        aria-label={isFullscreen ? "退出全屏" : "全屏查看"}
        className="bg-surface text-text-secondary hover:text-text-primary absolute right-2 top-2 z-10 rounded-md border border-border p-1.5"
      >
        {isFullscreen ? (
          <Minimize2 className="size-4" />
        ) : (
          <Maximize2 className="size-4" />
        )}
      </button>
    </div>
  );
}
