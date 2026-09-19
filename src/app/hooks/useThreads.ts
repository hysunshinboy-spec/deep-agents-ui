import useSWRInfinite from "swr/infinite";
import { useEffect, useState } from "react";
import type { Thread } from "@langchain/langgraph-sdk";
import { Client } from "@langchain/langgraph-sdk";
import { getConfig } from "@/lib/config";
import { isUuid } from "@/lib/assistants";
import { getLanguage, translate, type Language } from "@/lib/i18n";
import { makeThreadTitle } from "@/app/utils/utils";
import {
  getPendingThreadTitle,
  subscribePendingThreadTitles,
} from "@/app/hooks/pendingThreadTitles";

export interface ThreadItem {
  id: string;
  updatedAt: Date;
  status: Thread["status"];
  title: string;
  description: string;
  assistantId?: string;
}

const DEFAULT_PAGE_SIZE = 20;

export function useThreads(props: {
  status?: Thread["status"];
  limit?: number;
}) {
  const pageSize = props.limit || DEFAULT_PAGE_SIZE;

  // 本地占位标题（发送时预生成）变化时触发重新渲染，让侧边栏立刻显示
  // 会话名，而不是等服务端 run 写出 values 再推导。
  const [pendingTitleVersion, setPendingTitleVersion] = useState(0);
  useEffect(
    () =>
      subscribePendingThreadTitles(() =>
        setPendingTitleVersion((v) => v + 1)
      ),
    []
  );
  void pendingTitleVersion;

  return useSWRInfinite(
    (pageIndex: number, previousPageData: ThreadItem[] | null) => {
      const config = getConfig();
      const apiKey =
        config?.langsmithApiKey ||
        process.env.NEXT_PUBLIC_LANGSMITH_API_KEY ||
        "";

      if (!config) {
        return null;
      }

      // If the previous page returned no items, we've reached the end
      if (previousPageData && previousPageData.length === 0) {
        return null;
      }

      return {
        kind: "threads" as const,
        pageIndex,
        pageSize,
        deploymentUrl: config.deploymentUrl,
        assistantId: config.assistantId,
        apiKey,
        status: props?.status,
        // Part of the key so that titles derived below (fallbacks for untitled
        // threads) are rebuilt when the language changes.
        language: getLanguage(),
      };
    },
    async ({
      deploymentUrl,
      assistantId,
      apiKey,
      status,
      pageIndex,
      pageSize,
      language,
    }: {
      kind: "threads";
      pageIndex: number;
      pageSize: number;
      deploymentUrl: string;
      assistantId: string;
      apiKey: string;
      status?: Thread["status"];
      language: Language;
    }) => {
      const client = new Client({
        apiUrl: deploymentUrl,
        defaultHeaders: apiKey ? { "X-Api-Key": apiKey } : {},
      });

      const threads = await client.threads.search({
        limit: pageSize,
        offset: pageIndex * pageSize,
        sortBy: "updated_at" as const,
        sortOrder: "desc" as const,
        status,
        // Only filter by assistant_id metadata for deployed graphs (UUIDs)
        // Local dev graphs don't set this metadata
        ...(isUuid(assistantId)
          ? { metadata: { assistant_id: assistantId } }
          : {}),
      });

      return threads.map((thread): ThreadItem => {
        let title = translate(language, "threads.untitled");
        let description = "";

        try {
          if (thread.values && typeof thread.values === "object") {
            const values = thread.values as any;
            const firstHumanMessage = values.messages.find(
              (m: any) => m.type === "human"
            );
            if (firstHumanMessage?.content) {
              const content =
                typeof firstHumanMessage.content === "string"
                  ? firstHumanMessage.content
                  : firstHumanMessage.content[0]?.text || "";
              title = makeThreadTitle(content);
            }
            const firstAiMessage = values.messages.find(
              (m: any) => m.type === "ai"
            );
            if (firstAiMessage?.content) {
              const content =
                typeof firstAiMessage.content === "string"
                  ? firstAiMessage.content
                  : firstAiMessage.content[0]?.text || "";
              description = content.slice(0, 100);
            }
          }
        } catch {
          // Fallback to thread ID
          title = translate(language, "threads.fallbackTitle", {
            id: thread.thread_id.slice(0, 8),
          });
        }

        // 服务端还没推出标题（run 尚未写出 values）时，顶上发送时
        // 预生成的占位标题，让会话名在会话开始执行时就出现。
        if (title === translate(language, "threads.untitled")) {
          title = getPendingThreadTitle(thread.thread_id) ?? title;
        }

        return {
          id: thread.thread_id,
          updatedAt: new Date(thread.updated_at),
          status: thread.status,
          title,
          description,
          assistantId,
        };
      });
    },
    {
      revalidateFirstPage: true,
      revalidateOnFocus: true,
    }
  );
}
