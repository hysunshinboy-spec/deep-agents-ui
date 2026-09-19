"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getConfig } from "@/lib/config";

/** 与后端 upload_app.py 里的状态机一一对应。 */
export type UploadStatus =
  | "uploading"
  | "parsing"
  | "fetching"
  | "done"
  | "failed";

export interface UploadState {
  filename: string;
  status: UploadStatus;
  /** 0–1。只有 uploading 阶段会真正推进，其余阶段恒为 1。 */
  progress: number;
  /** 失败发生在哪一段：convert = 代理/docling 转换；writeback = 转换已成功、
   *  但调用方在 onConverted 里写线程状态那一步失败。两种失败的处理方式不同，
   *  UI 文案也不同，不能混成一句「转换失败」。 */
  stage?: "convert" | "writeback";
  error?: string;
}

/** 两次轮询之间的间隔。上传本身要几分钟，1.5s 足够跟上进度又不会刷爆。 */
const POLL_INTERVAL_MS = 1500;
/** 轮询总时长上限。docling 那头自己也有一小时的解析上限，这里比它略长。 */
const POLL_TIMEOUT_MS = 70 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 把文件交给 upload_app 代理转换成 markdown。
 *
 * 浏览器 → 代理这一段走的是本机回环，瞬间完成；真正慢的是代理 → docling
 * 那一段（实测一份 5MB 的 PDF 上传约 24s、解析约 62s）。所以这里不做上传
 * 进度条，而是提交后轮询代理的状态接口 —— 进度由代理汇报，它才知道字节
 * 真正发出去了多少。
 */
export function useUpload({
  onConverted,
}: {
  /** 转换完成后回调，由调用方决定存到虚拟文件系统的哪个路径。 */
  onConverted: (sourceName: string, markdown: string) => void | Promise<void>;
}) {
  const [state, setState] = useState<UploadState | null>(null);
  // 组件卸载后停止轮询；否则会在已卸载的组件上 setState。
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const reset = useCallback(() => setState(null), []);

  const upload = useCallback(
    async (file: File) => {
      const config = getConfig();
      if (!config?.deploymentUrl) {
        setState({
          filename: file.name,
          status: "failed",
          progress: 0,
          error: "no-deployment-url",
        });
        return;
      }
      const base = config.deploymentUrl.replace(/\/$/, "");

      const patch = (next: Partial<UploadState>) => {
        if (aliveRef.current) {
          setState((prev) =>
            prev ? { ...prev, ...next } : (next as UploadState)
          );
        }
      };

      setState({
        filename: file.name,
        status: "uploading",
        progress: 0,
      });

      try {
        const submit = await fetch(
          `${base}/upload?filename=${encodeURIComponent(file.name)}`,
          { method: "POST", body: file }
        );
        if (!submit.ok) {
          throw new Error(
            `${submit.status} ${(await submit.text()).slice(0, 200)}`
          );
        }
        const { task_id: taskId } = await submit.json();

        const deadline = Date.now() + POLL_TIMEOUT_MS;
        for (;;) {
          if (!aliveRef.current) return;
          if (Date.now() > deadline) throw new Error("timeout");

          const res = await fetch(`${base}/upload/status/${taskId}`);
          if (!res.ok) {
            throw new Error(
              `${res.status} ${(await res.text()).slice(0, 200)}`
            );
          }
          const status = await res.json();
          patch({ status: status.status, progress: status.progress ?? 0 });

          if (status.status === "failed") {
            throw new Error(status.error || "conversion failed");
          }
          if (status.status === "done") break;

          await sleep(POLL_INTERVAL_MS);
        }

        const res = await fetch(`${base}/upload/result/${taskId}`);
        if (!res.ok) {
          throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
        }
        const { markdown } = await res.json();
        // 走到这里转换已经成功，先把状态落定；onConverted（通常是写线程
        // 虚拟文件系统）失败属于回写失败，单独标记，别算到转换头上。
        patch({ status: "done", progress: 1 });
        try {
          await onConverted(file.name, markdown);
        } catch (error) {
          patch({
            status: "failed",
            stage: "writeback",
            progress: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } catch (error) {
        patch({
          status: "failed",
          stage: "convert",
          progress: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [onConverted]
  );

  return { upload, state, reset };
}
