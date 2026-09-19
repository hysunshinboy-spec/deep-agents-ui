"use client";

import React, { useMemo, useState, useCallback } from "react";
import { SubAgentIndicator } from "@/app/components/SubAgentIndicator";
import { ToolCallBox } from "@/app/components/ToolCallBox";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import { CopyButton } from "@/app/components/CopyButton";
import { MessageFileCard } from "@/app/components/MessageFileCard";
import type {
  SubAgent,
  ToolCall,
  ApprovalDecision,
  ApprovalSlot,
  ReviewConfig,
  FileMap,
} from "@/app/types/types";
import { Message } from "@langchain/langgraph-sdk";
import {
  extractSubAgentContent,
  extractStringFromMessageContent,
  parseMessageAttachments,
} from "@/app/utils/utils";
import { useI18n } from "@/providers/I18nProvider";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: Message;
  toolCalls: ToolCall[];
  isLoading?: boolean;
  /** 本条消息是否正在被流式追加（仅最后一条助手消息为 true） */
  isStreaming?: boolean;
  approvalSlotsByToolCallId?: Map<string, ApprovalSlot>;
  reviewConfigsByToolName?: Map<string, ReviewConfig>;
  decisions?: Map<number, ApprovalDecision>;
  onDecide?: (index: number, decision: ApprovalDecision) => void;
  onUndo?: (index: number) => void;
  ui?: any[];
  stream?: any;
  graphId?: string;
  /** 线程虚拟文件系统的最新内容，用于展示 agent 生成/修改后的文件。 */
  files?: FileMap;
}

export const ChatMessage = React.memo<ChatMessageProps>(
  ({
    message,
    toolCalls,
    isLoading,
    isStreaming,
    approvalSlotsByToolCallId,
    reviewConfigsByToolName,
    decisions,
    onDecide,
    onUndo,
    ui,
    stream,
    graphId,
    files,
  }) => {
    const { t } = useI18n();
    const isUser = message.type === "human";
    const messageContent = extractStringFromMessageContent(message);
    const hasContent = messageContent && messageContent.trim() !== "";
    const hasToolCalls = toolCalls.length > 0;
    // 用户消息里可能带附件标记（（已附上文件：/uploads/xx.md）），渲染时拆出
    // 正文进气泡，附件以文件卡片跟在正文下面（内容到 files channel 里查）。
    const parsedMessage = useMemo(
      () => (isUser ? parseMessageAttachments(messageContent) : null),
      [isUser, messageContent]
    );

    /**
     * agent 生成的文件（write_file/edit_file）跟随在正文下方展示，
     * 不再只出现在输入框的文件弹层里。内容优先取 files channel 的最新值：
     * edit_file 之后 tool args 里的 content 已经过时。
     */
    const generatedFiles = useMemo(() => {
      if (isUser) return [];
      const byPath = new Map<string, { id: string; name: string; content: string }>();
      for (const toolCall of toolCalls) {
        if (toolCall.name !== "write_file" && toolCall.name !== "edit_file") {
          continue;
        }
        const path =
          typeof toolCall.args?.["file_path"] === "string"
            ? (toolCall.args["file_path"] as string)
            : null;
        if (!path) continue;
        const latest = files?.[path]?.content;
        const content =
          latest ??
          (typeof toolCall.args["content"] === "string"
            ? (toolCall.args["content"] as string)
            : undefined);
        if (content === undefined) continue;
        const name = path.split("/").filter(Boolean).pop() || path;
        byPath.set(path, { id: toolCall.id, name, content });
      }
      return Array.from(byPath.values());
    }, [isUser, toolCalls, files]);
    const subAgents = useMemo(() => {
      return toolCalls
        .filter((toolCall: ToolCall) => {
          return (
            toolCall.name === "task" &&
            toolCall.args["subagent_type"] &&
            toolCall.args["subagent_type"] !== "" &&
            toolCall.args["subagent_type"] !== null
          );
        })
        .map((toolCall: ToolCall) => {
          const subagentType = (toolCall.args as Record<string, unknown>)[
            "subagent_type"
          ] as string;
          return {
            id: toolCall.id,
            name: toolCall.name,
            subAgentName: subagentType,
            input: toolCall.args,
            output: toolCall.result ? { result: toolCall.result } : undefined,
            status: toolCall.status,
          } as SubAgent;
        });
    }, [toolCalls]);

    const [expandedSubAgents, setExpandedSubAgents] = useState<
      Record<string, boolean>
    >({});
    const isSubAgentExpanded = useCallback(
      (id: string) => expandedSubAgents[id] ?? true,
      [expandedSubAgents]
    );
    const toggleSubAgent = useCallback((id: string) => {
      setExpandedSubAgents((prev) => ({
        ...prev,
        [id]: prev[id] === undefined ? false : !prev[id],
      }));
    }, []);

    return (
      <div
        className={cn(
          "flex w-full max-w-full overflow-x-hidden",
          isUser && "flex-row-reverse"
        )}
      >
        <div
          className={cn(
            "min-w-0 max-w-full",
            isUser ? "max-w-[70%]" : "w-full"
          )}
        >
          {isUser ? (
            <>
              {parsedMessage!.text && (
                <div className={cn("relative flex items-end gap-0")}>
                  <div
                    className={cn(
                      "mt-4 overflow-hidden break-words text-sm font-normal leading-[150%]",
                      "rounded-xl rounded-br-none border border-border px-3 py-2 text-foreground"
                    )}
                    style={{ backgroundColor: "var(--color-user-message-bg)" }}
                  >
                    <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {parsedMessage!.text}
                    </p>
                  </div>
                </div>
              )}
              {parsedMessage!.paths.length > 0 && (
                <div className="mt-2 flex w-full flex-col gap-2">
                  {parsedMessage!.paths.map((path) => {
                    const data = files?.[path];
                    if (!data) return null;
                    const name =
                      path.split("/").filter(Boolean).pop() || path;
                    return (
                      <MessageFileCard
                        key={path}
                        name={name}
                        content={data.content}
                      />
                    );
                  })}
                </div>
              )}
              {parsedMessage!.text && (
                // 复制正文（不含附件内容；附件卡片自带复制按钮）。
                <div className="mt-0.5 flex justify-end">
                  <CopyButton text={parsedMessage!.text} />
                </div>
              )}
            </>
          ) : (
            hasContent && (
              <>
                <div className="relative flex items-end gap-0">
                  <div className="mt-4 overflow-hidden break-words text-sm font-normal leading-[150%] text-[var(--color-text-primary)]">
                    <MarkdownContent
                      content={messageContent}
                      streamFinished={!isStreaming}
                    />
                  </div>
                </div>
                <div className="mt-1 flex justify-start">
                  <CopyButton text={messageContent} />
                </div>
                {generatedFiles.length > 0 && (
                  <div className="mt-2 flex w-full flex-col gap-2">
                    {generatedFiles.map((file) => (
                      <MessageFileCard
                        key={file.id}
                        name={file.name}
                        content={file.content}
                      />
                    ))}
                  </div>
                )}
              </>
            )
          )}
          {hasToolCalls && (
            <div className="mt-4 flex w-full flex-col">
              {toolCalls.map((toolCall: ToolCall) => {
                if (toolCall.name === "task") return null;
                const toolCallGenUiComponent = ui?.find(
                  (u) => u.metadata?.tool_call_id === toolCall.id
                );
                const slot = approvalSlotsByToolCallId?.get(toolCall.id);
                const reviewConfig = slot
                  ? reviewConfigsByToolName?.get(slot.actionRequest.name)
                  : undefined;
                return (
                  <ToolCallBox
                    key={toolCall.id}
                    toolCall={toolCall}
                    uiComponent={toolCallGenUiComponent}
                    stream={stream}
                    graphId={graphId}
                    actionRequest={slot?.actionRequest}
                    index={slot?.index}
                    reviewConfig={reviewConfig}
                    decision={slot ? decisions?.get(slot.index) : undefined}
                    onDecide={onDecide}
                    onUndo={onUndo}
                    isLoading={isLoading}
                  />
                );
              })}
            </div>
          )}
          {!isUser && subAgents.length > 0 && (
            <div className="flex w-fit max-w-full flex-col gap-4">
              {subAgents.map((subAgent) => (
                <div
                  key={subAgent.id}
                  className="flex w-full flex-col gap-2"
                >
                  <div className="flex items-end gap-2">
                    <div className="w-[calc(100%-100px)]">
                      <SubAgentIndicator
                        subAgent={subAgent}
                        onClick={() => toggleSubAgent(subAgent.id)}
                        isExpanded={isSubAgentExpanded(subAgent.id)}
                      />
                    </div>
                  </div>
                  {isSubAgentExpanded(subAgent.id) && (
                    <div className="w-full max-w-full">
                      <div className="bg-[var(--color-surface)] border-[var(--color-border-light)] rounded-md border p-4">
                        <h4 className="text-[var(--color-text-secondary)] mb-2 text-xs font-semibold uppercase tracking-wider">
                          {t("common.input")}
                        </h4>
                        <div className="mb-4">
                          <MarkdownContent
                            content={extractSubAgentContent(subAgent.input)}
                          />
                        </div>
                        {subAgent.output && (
                          <>
                            <h4 className="text-[var(--color-text-secondary)] mb-2 text-xs font-semibold uppercase tracking-wider">
                              {t("common.output")}
                            </h4>
                            <MarkdownContent
                              content={extractSubAgentContent(subAgent.output)}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = "ChatMessage";
