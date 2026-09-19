"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import {
  type Message,
  type Assistant,
  type Checkpoint,
} from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import type { UseStreamThread } from "@langchain/langgraph-sdk/react";
import type { FileMap, TodoItem } from "@/app/types/types";
import { useClient } from "@/providers/ClientProvider";
import { useQueryState } from "nuqs";
import { setPendingThreadTitle } from "@/app/hooks/pendingThreadTitles";
import { makeThreadTitle } from "@/app/utils/utils";

export type StateType = {
  messages: Message[];
  todos: TodoItem[];
  files: FileMap;
  email?: {
    id?: string;
    subject?: string;
    page_content?: string;
  };
  ui?: any;
};

export function useChat({
  activeAssistant,
  onHistoryRevalidate,
  thread,
}: {
  activeAssistant: Assistant | null;
  onHistoryRevalidate?: () => void;
  thread?: UseStreamThread<StateType>;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const client = useClient();
  // 已经通过 `setFiles` 写进线程、但 hook 那份 `values` 缓存还不知道的文件。
  // 详见 `setFiles` 上的注释。
  const [pendingFiles, setPendingFiles] = useState<FileMap>({});

  const stream = useStream<StateType>({
    assistantId: activeAssistant?.assistant_id || "",
    client: client ?? undefined,
    reconnectOnMount: true,
    threadId: threadId ?? null,
    onThreadId: setThreadId,
    defaultHeaders: { "x-auth-scheme": "langsmith" },
    // Enable fetching state history when switching to existing threads
    fetchStateHistory: true,
    // Revalidate thread list when stream finishes, errors, or creates new thread
    onFinish: onHistoryRevalidate,
    onError: onHistoryRevalidate,
    onCreated: onHistoryRevalidate,
    experimental_thread: thread,
  });

  // ------------------------------------------------------------------
  // 线程创建单例
  //
  // `useStream` 的 submit 在 threadId 为空时会自己 `threads.create`
  // 建线程,`setFiles` 此前也是——两者并发时会建出**两个**线程(实测
  // 2026-09-18:消息进了 submit 建的那个,文件进了 setFiles 建的那个,
  // URL 最后被 setFiles 覆盖,界面显示一个既没有消息也没有输出的
  // 「空线程」)。这里把「确保线程存在」收敛成一条 in-flight Promise:
  // 谁先到谁建,其余调用复用同一个 id。
  //
  // 另一个时序坑:SDK 的 submit 闭包捕获的是**渲染那一刻**的
  // options.threadId,setThreadId 之后必须等 React 重新渲染、
  // useStream 拿到新 threadId,再调用 submit;否则它眼里还是 null,
  // 照样再建一个线程。所以发消息要走 streamRef(每次渲染刷新)取
  // 最新的 submit,并等 threadIdRef 跟上。
  // ------------------------------------------------------------------
  const threadIdRef = useRef<string | null>(threadId);
  // ensureThreadId 的 in-flight 创建;非空期间并发调用复用同一条 Promise。
  const threadCreationRef = useRef<Promise<string> | null>(null);
  // 下一次 threadId 变化是否「本 hook 自己建线程」所致(ensureThreadId)。
  // 消费方(如 ChatInterface 的会话隔离 effect)用它区分「发送/上传途中的
  // null→id 跃迁」和「用户切换会话」:前者是同一会话的延续,不能清输入态;
  // 后者必须清。读取端只 peek(子组件的 effect 先于本 hook 的 effect 执行),
  // 由本 hook 下面清理 pendingFiles 的 effect 统一复位。
  const ownThreadChangeRef = useRef(false);
  const streamRef = useRef(stream);
  useEffect(() => {
    threadIdRef.current = threadId;
    if (threadId) {
      // 已经落到一个确定的线程,创建单例(若有)使命完成,可以换新。
      threadCreationRef.current = null;
    }
    streamRef.current = stream;
  });

  /** 在 ref 里(threadId 状态真正落到 hook 上)出现指定 id。 */
  const waitForThreadId = useCallback(
    (id: string) =>
      new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + 3000;
        const tick = () => {
          if (threadIdRef.current === id) {
            resolve();
          } else if (Date.now() > deadline) {
            reject(new Error(`threadId ${id} did not propagate to useStream`));
          } else {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      }),
    []
  );

  const ensureThreadId = useCallback(async (): Promise<string> => {
    if (threadIdRef.current) return threadIdRef.current;
    if (!client || !activeAssistant?.graph_id) {
      throw new Error("no assistant available to create thread");
    }
    if (!threadCreationRef.current) {
      const graphId = activeAssistant.graph_id;
      const creating = client.threads
        .create({ graphId })
        .then((created) => created.thread_id);
      // 创建失败不能留下 rejected 的 Promise,否则后续发送永远失败。
      creating.catch(() => {
        if (threadCreationRef.current === creating) {
          threadCreationRef.current = null;
        }
      });
      threadCreationRef.current = creating;
    }
    const id = await threadCreationRef.current;
    // 写成功之后再切 threadId(同 setFiles 的老规矩)。赢的一方和
    // 竞态里输掉 await 的一方都会走到这里,setThreadId 幂等。
    // 标记这是「自己建线程」导致的跃迁,会话隔离逻辑要靠它辨认。
    ownThreadChangeRef.current = true;
    setThreadId(id);
    return id;
  }, [client, activeAssistant, setThreadId]);

  // 服务端状态一旦包含了这次补进去的每个路径，本地补丁就完成使命了，撤掉；
  // 否则它会一直盖住 agent 之后对同一路径的修改。
  const serverFiles = stream.values.files;
  useEffect(() => {
    const mine = Object.keys(pendingFiles);
    if (mine.length === 0) return;
    const server = serverFiles ?? {};
    if (mine.every((path) => path in server)) setPendingFiles({});
  }, [serverFiles, pendingFiles]);

  const files = useMemo(
    () => ({ ...(serverFiles ?? {}), ...pendingFiles }),
    [serverFiles, pendingFiles]
  );

  // pendingFiles 是写给「当时那个线程」的本地补丁。除了「发送/上传途中
  // 自己建线程」的 null→id 跃迁(补丁正是写给这个新线程的,要保留),任何
  // 线程切换都必须丢掉它 —— 否则旧会话的文件会以补丁形式叠进新会话的文件
  // 列表,而新会话的服务端状态永远不会包含这些路径,补丁永远撤不掉。
  const prevThreadIdRef = useRef(threadId);
  useEffect(() => {
    const prev = prevThreadIdRef.current;
    prevThreadIdRef.current = threadId;
    const ownChange = ownThreadChangeRef.current;
    ownThreadChangeRef.current = false;
    if (prev === threadId) return;
    if (prev == null && threadId != null && ownChange) return;
    setPendingFiles({});
  }, [threadId]);

  const sendInFlightRef = useRef(false);
  const sendMessage = useCallback(
    (content: string, title?: string) => {
      // 双击/连按发送只放行一个。isLoading 要等 stream 真正跑起来才置位,
      // ensureThreadId + 等渲染这段时间窗口得靠这个 ref 兜住。
      if (sendInFlightRef.current) return;
      sendInFlightRef.current = true;
      void (async () => {
        // 新会话第一次发送:先把线程建好并等 useStream 看到新 threadId,
        // 否则 submit 内部会再建一个线程,消息和文件再次分家。
        if (!threadIdRef.current) {
          const id = await ensureThreadId();
          await waitForThreadId(id);
        }
        // 线程 id 一确定就把标题占位写上（不等 run 结果），侧边栏立即显示
        // 会话名。title 由调用方从原始输入生成，不含附件路径等拼装的痕迹。
        setPendingThreadTitle(threadIdRef.current!, title ?? makeThreadTitle(content));
        const newMessage: Message = { id: uuidv4(), type: "human", content };
        // 必须取最新渲染的 stream:本闭包里的 submit 捕获的是旧 threadId。
        streamRef.current.submit(
          { messages: [newMessage] },
          {
            optimisticValues: (prev) => ({
              messages: [...(prev.messages ?? []), newMessage],
            }),
            config: { ...(activeAssistant?.config ?? {}), recursion_limit: 100 },
          }
        );
        // Update thread list immediately when sending a message
        onHistoryRevalidate?.();
      })()
        .finally(() => {
          sendInFlightRef.current = false;
        })
        .catch((err) => {
          // 线程建不起来(服务端挂了/超时)时 submit 根本没发生,stream
          // 的 onError 不会兜这条 —— 至少留一条醒目的日志,别静默吞掉。
          console.error("发送失败:未能确保线程存在", err);
        });
    },
    [
      ensureThreadId,
      waitForThreadId,
      activeAssistant?.config,
      onHistoryRevalidate,
    ]
  );

  const runSingleStep = useCallback(
    (
      messages: Message[],
      checkpoint?: Checkpoint,
      isRerunningSubagent?: boolean,
      optimisticMessages?: Message[]
    ) => {
      if (checkpoint) {
        stream.submit(undefined, {
          ...(optimisticMessages
            ? { optimisticValues: { messages: optimisticMessages } }
            : {}),
          config: activeAssistant?.config,
          checkpoint: checkpoint,
          ...(isRerunningSubagent
            ? { interruptAfter: ["tools"] }
            : { interruptBefore: ["tools"] }),
        });
      } else {
        stream.submit(
          { messages },
          { config: activeAssistant?.config, interruptBefore: ["tools"] }
        );
      }
    },
    [stream, activeAssistant?.config]
  );

  /**
   * 把文件写进当前线程的 `files` channel。
   *
   * 直接调 `client.threads.updateState` 写 checkpoint，不走 `submit`。
   * 走 `submit` 会真的把图跑起来 —— `goto: "__end__"` 并不会跳过入口节点，
   * 所以每写一次文件就白跑一整轮 agent：一次无谓的 LLM 调用，外加对话里
   * 冒出一条莫名其妙的回复。
   *
   * 有两个坑要绕：
   *
   * 1. 线程必须先绑定到某个图才能写，否则 `updateState` 返回 400
   *    （"has no assigned graph ID"）。绑图只有一个入口：线程的
   *    `metadata.graph_id`，而且必须是**图名**，写 assistant UUID 会变成
   *    404「Graph '...' not found」。线程本身统一由 `ensureThreadId` 单例
   *    创建（顶层 `graphId` 参数，SDK 内部落成 `metadata.graph_id`）；
   *    千万别在这里自己 `threads.create` —— 和 sendMessage 并发时会建出
   *    第二个线程，消息和文件分家。老线程（比如 useStream 自己建的）可能
   *    没绑图，这里用 `threads.update` 补一个；PATCH 是合并语义。
   * 2. `updateState` 只动 checkpoint；hook 手里的 `values` 是它自己拉回来的
   *    历史缓存。SDK 没有导出内建 history 的 `mutate`，外部没有受支持的办法
   *    刷新那份缓存。所以用 `pendingFiles` 在本地先顶上，等真正的历史拉回来
   *    再撤掉。
   *
   * 这个 channel 的 reducer 是按 key 合并的，所以 `patch` 只给要改的条目即可，
   * 不必把整个 map 传回去。
   */
  const setFiles = useCallback(
    async (patch: FileMap) => {
      if (!client || !activeAssistant?.assistant_id) {
        throw new Error("no assistant available to write files to");
      }
      setPendingFiles((prev) => ({ ...prev, ...patch }));
      try {
        // 线程走 ensureThreadId 单例：和 sendMessage 并发时各自建线程
        // 会把消息和文件拆进两个线程（实测踩过）。
        const id = await ensureThreadId();
        // 补绑图（PATCH 合并语义；ensureThreadId 刚建的线程多这一拍无害）。
        await client.threads.update(id, {
          metadata: { graph_id: activeAssistant.graph_id },
        });
        // 从第二次写入起必须给 `asNode`，否则 LangGraph 返回 400
        // "Ambiguous update, specify as_node"。`__start__` 是唯一能让写完后
        // `next` 仍停在入口节点的取值，这样之后发消息还是一轮正常的对话。
        await client.threads.updateState(id, {
          values: { files: patch },
          asNode: "__start__",
        });
      } catch (err) {
        // 把这次叠上去的条目从本地补丁里撤掉，避免 UI 显示一个其实并不在
        // 线程状态里的文件。
        setPendingFiles((prev) => {
          const next = { ...prev };
          for (const path of Object.keys(patch)) delete next[path];
          return next;
        });
        throw err;
      }
    },
    [client, activeAssistant, ensureThreadId]
  );

  /** Store one file's text content at `path`, stamping it as just modified. */
  const addFile = useCallback(
    async (path: string, content: string) => {
      const now = new Date().toISOString();
      await setFiles({
        [path]: {
          content,
          encoding: "utf-8",
          created_at: now,
          modified_at: now,
        },
      });
    },
    [setFiles]
  );

  const continueStream = useCallback(
    (hasTaskToolCall?: boolean) => {
      stream.submit(undefined, {
        config: {
          ...(activeAssistant?.config || {}),
          recursion_limit: 100,
        },
        ...(hasTaskToolCall
          ? { interruptAfter: ["tools"] }
          : { interruptBefore: ["tools"] }),
      });
      // Update thread list when continuing stream
      onHistoryRevalidate?.();
    },
    [stream, activeAssistant?.config, onHistoryRevalidate]
  );

  const markCurrentThreadAsResolved = useCallback(() => {
    stream.submit(null, { command: { goto: "__end__", update: null } });
    // Update thread list when marking thread as resolved
    onHistoryRevalidate?.();
  }, [stream, onHistoryRevalidate]);

  const resumeInterrupt = useCallback(
    (value: any) => {
      stream.submit(null, { command: { resume: value } });
      // Update thread list when resuming from interrupt
      onHistoryRevalidate?.();
    },
    [stream, onHistoryRevalidate]
  );

  const stopStream = useCallback(() => {
    stream.stop();
  }, [stream]);

  return {
    stream,
    threadId: threadId ?? null,
    // peek 不清:标记由上面清理 pendingFiles 的 effect 统一复位。
    isOwnThreadChange: () => ownThreadChangeRef.current,
    todos: stream.values.todos ?? [],
    files,
    email: stream.values.email,
    ui: stream.values.ui,
    setFiles,
    addFile,
    messages: stream.messages,
    isLoading: stream.isLoading,
    isThreadLoading: stream.isThreadLoading,
    interrupt: stream.interrupt,
    getMessagesMetadata: stream.getMessagesMetadata,
    sendMessage,
    runSingleStep,
    continueStream,
    stopStream,
    markCurrentThreadAsResolved,
    resumeInterrupt,
  };
}
