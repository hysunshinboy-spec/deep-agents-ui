"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  FormEvent,
  Fragment,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Square,
  ArrowUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Circle,
  Paperclip,
  Loader2,
} from "lucide-react";
import { ChatMessage } from "@/app/components/ChatMessage";
import { ToolApprovalInterrupt } from "@/app/components/ToolApprovalInterrupt";
import { MessageFileCard } from "@/app/components/MessageFileCard";
import type { TodoItem, ToolCall } from "@/app/types/types";
import { Assistant, Message } from "@langchain/langgraph-sdk";
import {
  extractStringFromMessageContent,
  composeMessageWithFiles,
  makeThreadTitle,
  type PendingAttachment,
} from "@/app/utils/utils";
import { useToolApproval } from "@/app/hooks/useToolApproval";
import { useUpload } from "@/app/hooks/useUpload";
import { useChatContext } from "@/providers/ChatProvider";
import { useI18n } from "@/providers/I18nProvider";
import { cn } from "@/lib/utils";
import { useStickToBottom } from "use-stick-to-bottom";

interface ChatInterfaceProps {
  assistant: Assistant | null;
}

const TODO_STATUS_KEYS: Record<TodoItem["status"], string> = {
  pending: "tasks.statusPending",
  in_progress: "tasks.statusInProgress",
  completed: "tasks.statusCompleted",
};

/** 转换完成但线程还在跑（agent 本轮未结束）而暂时写不进去的文件。 */
interface QueuedConversion {
  name: string;
  path: string;
  markdown: string;
  /** 发起上传时的会话纪元；补写时纪元已变（用户切走了）就丢弃，别写进新会话。 */
  epoch: number;
}

/**
 * 判断「线程忙」错误：服务端在有 in-flight run 时拒绝 updateState，返回
 * 409（langgraph SDK 的非 2xx 会抛带数字 status 的 HTTPError）。
 * 这种不是真失败 —— 等本轮 run 结束后补写即可，见 ChatInterface 的 flush effect。
 */
const isThreadBusyError = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  (err as { status?: unknown }).status === 409;

const getStatusIcon = (status: TodoItem["status"], className?: string) => {
  switch (status) {
    case "completed":
      return (
        <CheckCircle
          size={16}
          className={cn("text-[var(--color-success)]", className)}
        />
      );
    case "in_progress":
      return (
        <Clock
          size={16}
          className={cn("text-[var(--color-warning)]", className)}
        />
      );
    default:
      return (
        <Circle
          size={16}
          className={cn("text-[var(--color-text-tertiary)]", className)}
        />
      );
  }
};

export const ChatInterface = React.memo<ChatInterfaceProps>(({ assistant }) => {
  const { t } = useI18n();
  const [metaOpen, setMetaOpen] = useState<"tasks" | null>(null);
  const tasksContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [input, setInput] = useState("");
  // 已解析完、等随下一条消息一起发出的附件。文件解析完成即写进线程的
  // 虚拟文件系统（模型靠 FilesManifestMiddleware 看到内容），这里只暂存
  // 路径；发送时 composeMessageWithFiles 把路径清单拼进消息体。
  // ref 是权威副本：排队发送的 effect 依赖它，不受 setState 批处理时序影响。
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  // 文件还在解析时用户就发了消息：先把正文挂到聊天区渲染成「待发送气泡」，
  // 等文件落盘（或解析失败）再决定真正发出去还是还回输入框。
  const queuedMessageRef = useRef<string | null>(null);
  const [queuedText, setQueuedText] = useState<string | null>(null);
  // 上传时线程正在跑（agent 本轮未结束），服务端拒绝 updateState（409）。
  // 文件内容先留在本地排队，等 isLoading 落回 false 后由 flush effect 补写；
  // ref 是权威副本，state 只驱动 UI 提示和 effect 依赖。
  const writebackQueueRef = useRef<QueuedConversion[]>([]);
  const [queuedConversions, setQueuedConversions] = useState<
    QueuedConversion[]
  >([]);
  const flushingRef = useRef(false);
  // 会话纪元:每次「用户发起的线程切换」+1(见下面的会话隔离 effect),
  // 发送/上传途中自己建线程(null→id)不算切换,纪元不变。上传开始时记下
  // 纪元;转换完成时纪元变了,说明用户已经离开那个会话,结果必须丢弃 —
  // 否则旧会话的文件会被写进新会话的线程状态。
  const sessionEpochRef = useRef(0);
  const uploadEpochRef = useRef(0);
  // 补写阶段遇到非「线程忙」的失败（已无从重试），单独展示，别混进转换状态。
  const [writebackError, setWritebackError] = useState<string | null>(null);
  const { scrollRef, contentRef } = useStickToBottom();

  const {
    stream,
    threadId,
    isOwnThreadChange,
    messages,
    todos,
    files,
    ui,
    addFile,
    isLoading,
    isThreadLoading,
    interrupt,
    sendMessage,
    stopStream,
    resumeInterrupt,
  } = useChatContext();

  const submitDisabled = isLoading || !assistant;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * 转换结果落到虚拟文件系统的路径。同名文件重复上传时顺延编号，避免后一次
   * 悄无声息地覆盖前一次的内容。
   */
  const uploadPath = useCallback(
    (sourceName: string) => {
      const stem = sourceName.replace(/\.[^./\\]+$/, "") || "document";
      let path = `/uploads/${stem}.md`;
      for (let n = 2; files[path]; n += 1) {
        path = `/uploads/${stem}-${n}.md`;
      }
      return path;
    },
    [files]
  );

  const handleConverted = useCallback(
    async (sourceName: string, markdown: string) => {
      // 转换是异步的，期间用户可能切换/新建了会话。结果属于发起上传时的
      // 那个会话：写进当前会话会把旧资产带进新会话，直接丢弃（上传入口还
      // 在，在正确的会话里重传即可）。自己建线程（null→id）不 bump 纪元，
      // 所以草稿会话里多文件连续上传不受影响。
      if (sessionEpochRef.current !== uploadEpochRef.current) return;
      const path = uploadPath(sourceName);
      // 先写虚拟文件系统再记路径：写失败（比如还没选助手）会上报写入失败，
      // 路径也就不会进待发送清单。
      try {
        await addFile(path, markdown);
      } catch (err) {
        // 线程正忙（本轮 agent 还在跑）：不是真失败，排队等 run 结束补写。
        if (isThreadBusyError(err)) {
          writebackQueueRef.current = [
            ...writebackQueueRef.current,
            { name: sourceName, path, markdown, epoch: uploadEpochRef.current },
          ];
          setQueuedConversions(writebackQueueRef.current);
          return;
        }
        throw err;
      }
      const entry = { name: sourceName, path };
      pendingAttachmentsRef.current = [...pendingAttachmentsRef.current, entry];
      setPendingAttachments(pendingAttachmentsRef.current);
    },
    [addFile, uploadPath]
  );

  const {
    upload,
    state: uploadState,
    reset: resetUpload,
  } = useUpload({ onConverted: handleConverted });

  const handleFilePick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // 立刻清空 value：否则连续选同一个文件不会再触发 change 事件。
      e.target.value = "";
      setWritebackError(null);
      // 记下发起上传时的会话纪元；转换完成时据此判断会话是否已切换。
      uploadEpochRef.current = sessionEpochRef.current;
      if (file) await upload(file);
    },
    [upload]
  );

  const uploadLabel = useMemo(() => {
    // 排队的提示最优先：文件在等线程空转，「已转换」的状态文案会把它盖住。
    if (queuedConversions.length > 0) {
      return t("chat.uploadQueued", {
        name: queuedConversions.map((q) => q.name).join(", "),
      });
    }
    if (writebackError) {
      return t("chat.uploadWritebackFailed", { error: writebackError });
    }
    if (!uploadState) return null;
    switch (uploadState.status) {
      case "uploading":
        return t("chat.uploading", {
          progress: Math.round(uploadState.progress * 100),
        });
      case "parsing":
        return t("chat.parsing");
      case "fetching":
        return t("chat.fetching");
      case "done":
        return t("chat.uploadConverted", { name: uploadState.filename });
      case "failed":
        return uploadState.stage === "writeback"
          ? t("chat.uploadWritebackFailed", {
              error: uploadState.error ?? "",
            })
          : t("chat.uploadFailed", {
              error: uploadState.error ?? "",
            });
    }
  }, [uploadState, queuedConversions, writebackError, t]);

  const uploadBusy =
    uploadState !== null &&
    uploadState.status !== "done" &&
    uploadState.status !== "failed";

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      if (e) {
        e.preventDefault();
      }
      const messageText = input.trim();
      if (!messageText || isLoading || submitDisabled) return;
      // 文件还在解析：把正文挂到聊天区显示「待发送气泡」，等文件落盘后
      // 和它一起发，避免模型在看不到文件的情况下先答一版。
      if (uploadBusy) {
        queuedMessageRef.current = messageText;
        setQueuedText(messageText);
        setInput("");
        return;
      }
      sendMessage(
        composeMessageWithFiles(messageText, pendingAttachmentsRef.current),
        makeThreadTitle(messageText)
      );
      pendingAttachmentsRef.current = [];
      setPendingAttachments([]);
      setInput("");
    },
    [input, isLoading, submitDisabled, uploadBusy, sendMessage, setInput]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (submitDisabled) return;
      // 输入法组字状态下按 Enter 是"确认拼音上屏"，不能触发提交；
      // 兼容个别不标 isComposing 的实现（keyCode 229 = 按键已被 IME 消费）
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, submitDisabled]
  );

  // —— 会话隔离：用户切换线程时清掉上一个会话遗留的输入态 ——
  // 待发送附件、排队消息、补写队列、解析提示、草稿都属于「当时那个会话」，
  // 带到新会话里就会出现旧附件幽灵般出现在输入框、并随第一条消息发给模型
  // 的问题（文件写在线程状态里，新会话的工作区根本没有它）。
  // 例外：null→id 若是发送/上传途中 ensureThreadId 自己建线程造成的跃迁
  // （isOwnThreadChange），会话其实在延续 —— 清理会把正要随排队消息发出的
  // 附件弄丢，必须跳过。本组件是 ChatProvider 的子组件，这个 effect 先于
  // useChat 里复位标记的 effect 执行，所以 isOwnThreadChange 是 peek。
  // 必须声明在补写 flush effect 之前：同一次提交里先清空队列，flush 就不会
  // 把旧会话的文件写进新会话。
  const prevThreadIdRef = useRef(threadId);
  useEffect(() => {
    const prev = prevThreadIdRef.current;
    prevThreadIdRef.current = threadId;
    if (prev === threadId) return;
    if (prev === null && isOwnThreadChange()) return;
    sessionEpochRef.current += 1;
    pendingAttachmentsRef.current = [];
    setPendingAttachments([]);
    queuedMessageRef.current = null;
    setQueuedText(null);
    writebackQueueRef.current = [];
    setQueuedConversions([]);
    setWritebackError(null);
    resetUpload();
    setInput("");
  }, [threadId, isOwnThreadChange, resetUpload]);

  // 本轮 run 结束（isLoading 落回 false）后，补写排队等线程空转的文件。
  // 409 期间服务端拒绝 updateState，硬写只会反复撞墙；run 之间（比如 HITL
  // 确认后自动续跑）仍可能再撞 409 —— 那种情况留在队里，下一轮结束再试。
  // 必须声明在「发排队消息」的 effect 之前：同一轮提交里先补写、登记附件，
  // 那个 effect 才会带着刚补写的文件路径把排队消息发出去。
  useEffect(() => {
    if (isLoading) return;
    const queue = writebackQueueRef.current;
    if (queue.length === 0 || flushingRef.current) return;
    flushingRef.current = true;
    void (async () => {
      try {
        for (const item of queue) {
          if (item.epoch !== sessionEpochRef.current) {
            // 发起上传的会话已经离开：补写目标是旧线程，别写进当前会话。
            writebackQueueRef.current = writebackQueueRef.current.filter(
              (q) => q.path !== item.path
            );
            continue;
          }
          try {
            await addFile(item.path, item.markdown);
            // 成功的条目要立即出队：留在队里会让「等本轮回复结束后自动写入」
            // 的提示永远不清，而且之后每次 isLoading 翻转都会重复补写同一路径。
            writebackQueueRef.current = writebackQueueRef.current.filter(
              (q) => q.path !== item.path
            );
            pendingAttachmentsRef.current = [
              ...pendingAttachmentsRef.current,
              { name: item.name, path: item.path },
            ];
          } catch (err) {
            if (isThreadBusyError(err)) continue; // run 又开新一轮，留在队里
            writebackQueueRef.current = writebackQueueRef.current.filter(
              (q) => q.path !== item.path
            );
            setWritebackError(err instanceof Error ? err.message : String(err));
          }
        }
      } finally {
        flushingRef.current = false;
        setQueuedConversions(writebackQueueRef.current);
        setPendingAttachments(pendingAttachmentsRef.current);
      }
    })();
  }, [isLoading, addFile]);

  // 文件解析完成 / 失败后，把排队等它的消息发出去（或还回输入框）。放这里
  // 而不是 handleConverted 里，是为了等 React 用新的 threadId 重新渲染完成、
  // stream 已绑定到正确线程之后再发，避免刚建好的线程还没绑上就提交。
  // 文件曾因「线程忙」排队的，要等补写落盘、附件登记进清单后再发，否则
  // 模型收到的消息里没有文件路径，看不到这份文件。
  useEffect(() => {
    const pending = queuedMessageRef.current;
    if (pending === null) return;
    if (uploadState?.status === "done") {
      if (queuedConversions.length > 0) return;
      queuedMessageRef.current = null;
      setQueuedText(null);
      sendMessage(
        composeMessageWithFiles(pending, pendingAttachmentsRef.current),
        makeThreadTitle(pending)
      );
      pendingAttachmentsRef.current = [];
      setPendingAttachments([]);
    } else if (uploadState?.status === "failed") {
      queuedMessageRef.current = null;
      setQueuedText(null);
      setInput(pending);
    }
  }, [uploadState?.status, queuedConversions, sendMessage, setInput]);

  // TODO: can we make this part of the hook?
  const processedMessages = useMemo(() => {
    /*
     1. Loop through all messages
     2. For each AI message, add the AI message, and any tool calls to the messageMap
     3. For each tool message, find the corresponding tool call in the messageMap and update the status and output
    */
    const messageMap = new Map<
      string,
      { message: Message; toolCalls: ToolCall[] }
    >();
    messages.forEach((message: Message) => {
      if (message.type === "ai") {
        const toolCallsInMessage: Array<{
          id?: string;
          function?: { name?: string; arguments?: unknown };
          name?: string;
          type?: string;
          args?: unknown;
          input?: unknown;
        }> = [];
        if (
          message.additional_kwargs?.tool_calls &&
          Array.isArray(message.additional_kwargs.tool_calls)
        ) {
          toolCallsInMessage.push(...message.additional_kwargs.tool_calls);
        } else if (message.tool_calls && Array.isArray(message.tool_calls)) {
          toolCallsInMessage.push(
            ...message.tool_calls.filter(
              (toolCall: { name?: string }) => toolCall.name !== ""
            )
          );
        } else if (Array.isArray(message.content)) {
          const toolUseBlocks = message.content.filter(
            (block: { type?: string }) => block.type === "tool_use"
          );
          toolCallsInMessage.push(...toolUseBlocks);
        }
        const toolCallsWithStatus = toolCallsInMessage.map(
          (toolCall: {
            id?: string;
            function?: { name?: string; arguments?: unknown };
            name?: string;
            type?: string;
            args?: unknown;
            input?: unknown;
          }) => {
            const name =
              toolCall.function?.name ||
              toolCall.name ||
              toolCall.type ||
              "unknown";
            const args =
              toolCall.function?.arguments ||
              toolCall.args ||
              toolCall.input ||
              {};
            return {
              id: toolCall.id || `tool-${Math.random()}`,
              name,
              args,
              status: interrupt ? "interrupted" : ("pending" as const),
            } as ToolCall;
          }
        );
        messageMap.set(message.id!, {
          message,
          toolCalls: toolCallsWithStatus,
        });
      } else if (message.type === "tool") {
        const toolCallId = message.tool_call_id;
        if (!toolCallId) {
          return;
        }
        for (const [, data] of messageMap.entries()) {
          const toolCallIndex = data.toolCalls.findIndex(
            (tc: ToolCall) => tc.id === toolCallId
          );
          if (toolCallIndex === -1) {
            continue;
          }
          data.toolCalls[toolCallIndex] = {
            ...data.toolCalls[toolCallIndex],
            status: "completed" as const,
            result: extractStringFromMessageContent(message),
          };
          break;
        }
      } else if (message.type === "human") {
        messageMap.set(message.id!, {
          message,
          toolCalls: [],
        });
      }
    });
    const processedArray = Array.from(messageMap.values());
    return processedArray.map((data, index) => {
      const prevMessage = index > 0 ? processedArray[index - 1].message : null;
      return {
        ...data,
        showAvatar: data.message.type !== prevMessage?.type,
      };
    });
  }, [messages, interrupt]);

  const groupedTodos = {
    in_progress: todos.filter((t) => t.status === "in_progress"),
    pending: todos.filter((t) => t.status === "pending"),
    completed: todos.filter((t) => t.status === "completed"),
  };

  const hasTasks = todos.length > 0;

  const approval = useToolApproval({
    interrupt,
    messages: processedMessages,
    isLoading,
    resumeInterrupt,
  });

  const decisionCount = approval.decisions.size;
  const actionRequestCount = approval.actionRequests.length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
        ref={scrollRef}
      >
        <div
          className="mx-auto w-full max-w-[1024px] px-6 pb-6 pt-4"
          ref={contentRef}
        >
          {isThreadLoading ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-muted-foreground">{t("common.loading")}</p>
            </div>
          ) : (
            <>
              {processedMessages.map((data, index) => {
                const messageUi = ui?.filter(
                  (u: any) => u.metadata?.message_id === data.message.id
                );
                const isHostMessage =
                  data.message.id === approval.hostMessageId;
                const isLastMessage =
                  index === processedMessages.length - 1;
                return (
                  <ChatMessage
                    key={data.message.id}
                    message={data.message}
                    toolCalls={data.toolCalls}
                    isLoading={isLoading}
                    isStreaming={isLoading && isLastMessage}
                    approvalSlotsByToolCallId={
                      isHostMessage ? approval.byToolCallId : undefined
                    }
                    reviewConfigsByToolName={
                      isHostMessage
                        ? approval.reviewConfigsByToolName
                        : undefined
                    }
                    decisions={approval.decisions}
                    onDecide={approval.decide}
                    onUndo={approval.undo}
                    ui={messageUi}
                    stream={stream}
                    graphId={assistant?.graph_id}
                    files={files}
                  />
                );
              })}

              {/* 文件还在解析时提交的消息：正文先渲染成「待发送气泡」，
                  解析完成后由上面的 effect 真正发出，无缝变成正式消息。 */}
              {queuedText != null && (
                <div className="flex w-full max-w-full flex-row-reverse overflow-x-hidden">
                  <div className="flex min-w-0 max-w-full flex-col items-end">
                    <div className="relative flex items-end gap-0">
                      <div
                        className="mt-4 overflow-hidden break-words rounded-xl rounded-br-none border border-border px-3 py-2 text-sm font-normal leading-[150%] text-foreground"
                        style={{ backgroundColor: "var(--color-user-message-bg)" }}
                      >
                        <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed">
                          {queuedText}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex w-full flex-col gap-2">
                      {/* 解析中的占位卡片 */}
                      <div className="flex items-center gap-2 overflow-hidden rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        <Loader2
                          size={14}
                          className="animate-spin"
                        />
                        <span className="truncate">
                          {uploadLabel ?? t("chat.parsing")}
                        </span>
                      </div>
                      {/* 本次已解析完、会随消息一起发出的附件 */}
                      {pendingAttachments.map((file) => (
                        <MessageFileCard
                          key={file.path}
                          name={file.name}
                          content={files[file.path]?.content ?? ""}
                        />
                      ))}
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {t("chat.waitingForFile")}
                    </div>
                  </div>
                </div>
              )}

              {/* An action request whose tool call could not be matched still
                  needs a card, otherwise the batch can never be completed. */}
              {approval.unmatched.map((slot) => (
                <div
                  key={`unmatched-${slot.index}`}
                  className="mt-4"
                >
                  <ToolApprovalInterrupt
                    actionRequest={slot.actionRequest}
                    index={slot.index}
                    reviewConfig={approval.reviewConfigsByToolName.get(
                      slot.actionRequest.name
                    )}
                    decision={approval.decisions.get(slot.index)}
                    onDecide={approval.decide}
                    onUndo={approval.undo}
                    isLoading={isLoading}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 bg-background">
        <div
          className={cn(
            "mx-4 mb-6 flex flex-shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-background",
            "mx-auto w-[calc(100%-32px)] max-w-[1024px] transition-colors duration-200 ease-in-out"
          )}
        >
          {actionRequestCount > 1 && (
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-[18px] py-2 text-xs text-muted-foreground">
              <AlertCircle size={14} />
              <span>
                {t("approval.batchProgress", {
                  done: decisionCount,
                  total: actionRequestCount,
                })}
              </span>
            </div>
          )}

          {hasTasks && (
            <div className="flex max-h-72 flex-col overflow-y-auto border-b border-border bg-sidebar empty:hidden">
              {!metaOpen && (
                <>
                  {(() => {
                    const activeTask = todos.find(
                      (t) => t.status === "in_progress"
                    );

                    const totalTasks = todos.length;
                    const remainingTasks =
                      totalTasks - groupedTodos.pending.length;
                    const isCompleted = totalTasks === remainingTasks;

                    const tasksTrigger = (() => {
                      if (!hasTasks) return null;
                      return (
                        <button
                          type="button"
                          onClick={() =>
                            setMetaOpen((prev) =>
                              prev === "tasks" ? null : "tasks"
                            )
                          }
                          className="grid w-full cursor-pointer grid-cols-[auto_auto_1fr] items-center gap-3 px-[18px] py-3 text-left"
                          aria-expanded={metaOpen === "tasks"}
                        >
                          {(() => {
                            if (isCompleted) {
                              return [
                                <CheckCircle
                                  key="icon"
                                  size={16}
                                  className="text-[var(--color-success)]"
                                />,
                                <span
                                  key="label"
                                  className="ml-[1px] min-w-0 truncate text-sm"
                                >
                                  {t("chat.allTasksCompleted")}
                                </span>,
                              ];
                            }

                            if (activeTask != null) {
                              return [
                                <div key="icon">
                                  {getStatusIcon(activeTask.status)}
                                </div>,
                                <span
                                  key="label"
                                  className="ml-[1px] min-w-0 truncate text-sm"
                                >
                                  {t("chat.taskOf", {
                                    current:
                                      totalTasks - groupedTodos.pending.length,
                                    total: totalTasks,
                                  })}
                                </span>,
                                <span
                                  key="content"
                                  className="min-w-0 gap-2 truncate text-sm text-muted-foreground"
                                >
                                  {activeTask.content}
                                </span>,
                              ];
                            }

                            return [
                              <Circle
                                key="icon"
                                size={16}
                                className="text-[var(--color-text-tertiary)]"
                              />,
                              <span
                                key="label"
                                className="ml-[1px] min-w-0 truncate text-sm"
                              >
                                {t("chat.taskOf", {
                                  current:
                                    totalTasks - groupedTodos.pending.length,
                                  total: totalTasks,
                                })}
                              </span>,
                            ];
                          })()}
                        </button>
                      );
                    })();

                    return tasksTrigger;
                  })()}
                </>
              )}

              {metaOpen && (
                <>
                  <div className="sticky top-0 flex items-stretch bg-sidebar text-sm">
                    {hasTasks && (
                      <button
                        type="button"
                        className="py-3 pr-4 first:pl-[18px] aria-expanded:font-semibold"
                        onClick={() =>
                          setMetaOpen((prev) =>
                            prev === "tasks" ? null : "tasks"
                          )
                        }
                        aria-expanded={metaOpen === "tasks"}
                      >
                        {t("chat.tasks")}
                      </button>
                    )}
                    <button
                      aria-label={t("common.close")}
                      className="flex-1"
                      onClick={() => setMetaOpen(null)}
                    />
                  </div>
                  <div
                    ref={tasksContainerRef}
                    className="px-[18px]"
                  >
                    {metaOpen === "tasks" &&
                      Object.entries(groupedTodos)
                        .filter(([_, todos]) => todos.length > 0)
                        .map(([status, todos]) => (
                          <div
                            key={status}
                            className="mb-4"
                          >
                            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                              {t(
                                TODO_STATUS_KEYS[status as TodoItem["status"]]
                              )}
                            </h3>
                            <div className="grid grid-cols-[auto_1fr] gap-3 rounded-sm p-1 pl-0 text-sm">
                              {todos.map((todo, index) => (
                                <Fragment key={`${status}_${todo.id}_${index}`}>
                                  {getStatusIcon(todo.status, "mt-0.5")}
                                  <span className="break-words text-inherit">
                                    {todo.content}
                                  </span>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        ))}
                  </div>
                </>
              )}
            </div>
          )}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isLoading ? t("chat.placeholderRunning") : t("chat.placeholder")
              }
              className="font-inherit field-sizing-content flex-1 resize-none border-0 bg-transparent px-[18px] pb-[13px] pt-[14px] text-sm leading-7 text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
              rows={1}
            />
            <div className="flex items-center justify-between gap-2 p-3">
              <div className="flex min-w-0 items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFilePick}
                  // docling 支持的输入格式；列出来是为了让系统文件选择器
                  // 默认过滤掉明显不能转的东西。
                  accept=".pdf,.docx,.pptx,.xlsx,.html,.htm,.md,.txt,.csv,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp,.ascii,.xml,.json,.vtt"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadBusy}
                  title={t("chat.upload")}
                  aria-label={t("chat.upload")}
                >
                  {uploadBusy ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Paperclip size={18} />
                  )}
                </Button>
                {/* 消息已提交、排队等文件解析时，解析状态只显示在聊天气泡里的
                    占位卡片上，输入框这里不再重复显示同一条「解析中…」。 */}
                {uploadLabel && queuedText == null && (
                  // 点一下清掉提示，免得成功/失败的文案一直挂在那儿。
                  <button
                    type="button"
                    onClick={() => {
                      resetUpload();
                      setWritebackError(null);
                    }}
                    title={uploadState?.error ?? writebackError ?? undefined}
                    className={cn(
                      "max-w-[24rem] cursor-pointer truncate text-xs",
                      uploadState?.status === "failed" || writebackError
                        ? "text-[var(--color-error)]"
                        : "text-[var(--color-text-tertiary)]"
                    )}
                  >
                    {uploadLabel}
                  </button>
                )}
              </div>
              <Button
                type={isLoading ? "button" : "submit"}
                variant={isLoading ? "destructive" : "default"}
                onClick={isLoading ? stopStream : handleSubmit}
                disabled={!isLoading && (submitDisabled || !input.trim())}
              >
                {isLoading ? (
                  <>
                    <Square size={14} />
                    <span>{t("chat.stop")}</span>
                  </>
                ) : (
                  <>
                    <ArrowUp size={18} />
                    <span>{t("chat.send")}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});

ChatInterface.displayName = "ChatInterface";
