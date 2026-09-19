import { Message } from "@langchain/langgraph-sdk";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ActionRequest, ApprovalSlot, ToolCall } from "@/app/types/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 会话标题规则：取首条消息纯文本的前 50 字符，超长补省略号。
 * 服务端从 thread values 推导标题和客户端发送时预生成占位标题共用这套逻辑，
 * 保证两者一致、占位标题能无缝被服务端标题接替。
 */
export function makeThreadTitle(text: string): string {
  const trimmed = text.trim();
  return trimmed.slice(0, 50) + (trimmed.length > 50 ? "..." : "");
}

export function extractStringFromMessageContent(message: Message): string {
  return typeof message.content === "string"
    ? message.content
    : Array.isArray(message.content)
    ? message.content
        .filter(
          (c: unknown) =>
            (typeof c === "object" &&
              c !== null &&
              "type" in c &&
              (c as { type: string }).type === "text") ||
            typeof c === "string"
        )
        .map((c: unknown) =>
          typeof c === "string"
            ? c
            : typeof c === "object" && c !== null && "text" in c
            ? (c as { text?: string }).text || ""
            : ""
        )
        .join("")
    : "";
}

export function extractSubAgentContent(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object") {
    const dataObj = data as Record<string, unknown>;

    // Try to extract description first
    if (dataObj.description && typeof dataObj.description === "string") {
      return dataObj.description;
    }

    // Then try prompt
    if (dataObj.prompt && typeof dataObj.prompt === "string") {
      return dataObj.prompt;
    }

    // For output objects, try result
    if (dataObj.result && typeof dataObj.result === "string") {
      return dataObj.result;
    }

    // Fallback to JSON stringification
    return JSON.stringify(data, null, 2);
  }

  // Fallback for any other type
  return JSON.stringify(data, null, 2);
}

/**
 * 待随消息发出的附件。文件解析完成后立即写进线程的虚拟文件系统
 * （模型经 FilesManifestMiddleware 拿到内容，见 research_agent.py），
 * 这里只记路径；发送时把路径清单作为标记拼进消息体，供聊天区渲染附件卡片。
 */
export interface PendingAttachment {
  name: string;
  /** 虚拟文件系统里的路径，如 /uploads/xxx.md。 */
  path: string;
}

/**
 * 把附件路径清单作为标记拼进用户正文。这个标记是双料的：模型看到
 * 「这轮附了哪些工作区文件」，前端 `parseMessageAttachments` 再把它
 * 拆回去渲染附件卡片。
 */
export function composeMessageWithFiles(
  text: string,
  files: PendingAttachment[]
): string {
  if (files.length === 0) return text;
  const paths = files.map((f) => f.path).join("、");
  return `${text}\n\n（已附上文件：${paths}）`;
}

export interface ParsedMessage {
  /** 去掉附件标记之后的正文。 */
  text: string;
  /** 标记里列出的工作区路径。 */
  paths: string[];
}

/**
 * `composeMessageWithFiles` 的逆操作：拆出正文和附件路径，附件内容到
 * `files` channel 里查（解析完就写进去了，历史记录从服务端拉回来也能解析）。
 */
export function parseMessageAttachments(content: string): ParsedMessage {
  const paths: string[] = [];
  const text = content
    .replace(/（已附上文件：([^）]+)）/g, (_match, list: string) => {
      paths.push(
        ...list
          .split("、")
          .map((p) => p.trim())
          .filter(Boolean)
      );
      return "\n";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, paths };
}

export function isPreparingToCallTaskTool(messages: Message[]): boolean {  const lastMessage = messages[messages.length - 1];
  return (
    (lastMessage.type === "ai" &&
      lastMessage.tool_calls?.some(
        (call: { name?: string }) => call.name === "task"
      )) ||
    false
  );
}

export function formatMessageForLLM(message: Message): string {
  let role: string;
  if (message.type === "human") {
    role = "Human";
  } else if (message.type === "ai") {
    role = "Assistant";
  } else if (message.type === "tool") {
    role = `Tool Result`;
  } else {
    role = message.type || "Unknown";
  }

  const timestamp = message.id ? ` (${message.id.slice(0, 8)})` : "";

  let contentText = "";

  // Extract content text
  if (typeof message.content === "string") {
    contentText = message.content;
  } else if (Array.isArray(message.content)) {
    const textParts: string[] = [];

    message.content.forEach((part: any) => {
      if (typeof part === "string") {
        textParts.push(part);
      } else if (part && typeof part === "object" && part.type === "text") {
        textParts.push(part.text || "");
      }
      // Ignore other types like tool_use in content - we handle tool calls separately
    });

    contentText = textParts.join("\n\n").trim();
  }

  // For tool messages, include additional tool metadata
  if (message.type === "tool") {
    const toolName = (message as any).name || "unknown_tool";
    const toolCallId = (message as any).tool_call_id || "";
    role = `Tool Result [${toolName}]`;
    if (toolCallId) {
      role += ` (call_id: ${toolCallId.slice(0, 8)})`;
    }
  }

  // Handle tool calls from .tool_calls property (for AI messages)
  const toolCallsText: string[] = [];
  if (
    message.type === "ai" &&
    message.tool_calls &&
    Array.isArray(message.tool_calls) &&
    message.tool_calls.length > 0
  ) {
    message.tool_calls.forEach((call: any) => {
      const toolName = call.name || "unknown_tool";
      const toolArgs = call.args ? JSON.stringify(call.args, null, 2) : "{}";
      toolCallsText.push(`[Tool Call: ${toolName}]\nArguments: ${toolArgs}`);
    });
  }

  // Combine content and tool calls
  const parts: string[] = [];
  if (contentText) {
    parts.push(contentText);
  }
  if (toolCallsText.length > 0) {
    parts.push(...toolCallsText);
  }

  if (parts.length === 0) {
    return `${role}${timestamp}: [Empty message]`;
  }

  if (parts.length === 1) {
    return `${role}${timestamp}: ${parts[0]}`;
  }

  return `${role}${timestamp}:\n${parts.join("\n\n")}`;
}

export function formatConversationForLLM(messages: Message[]): string {
  const formattedMessages = messages.map(formatMessageForLLM);
  return formattedMessages.join("\n\n---\n\n");
}

/**
 * Structural equality that ignores key order.
 *
 * `JSON.stringify` is not usable here: args that round-trip through the backend
 * can come back with a different key order, which compares unequal as strings
 * while being the same object.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => deepEqual(item, b[index]))
    );
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        deepEqual(left[key], right[key])
    )
  );
}

/**
 * Pair each action request from the interrupt with the tool call it belongs to.
 *
 * The backend does not put a tool call id on an action request, so the pairing
 * is inferred. Candidates are narrowed to unconsumed calls of the same name —
 * that alone skips non-interruptible calls (e.g. `task`) sharing the message.
 * An args match is preferred but never required, because `toolCall.args` is
 * sometimes still a JSON string, in which case the backend's call order is the
 * only signal left.
 *
 * Consumption spans both branches, so two calls with identical args still bind
 * one action request each.
 */
export function matchActionRequests(
  toolCalls: ToolCall[],
  actionRequests: ActionRequest[]
): { byToolCallId: Map<string, ApprovalSlot>; unmatched: ApprovalSlot[] } {
  const byToolCallId = new Map<string, ApprovalSlot>();
  const unmatched: ApprovalSlot[] = [];
  const consumed = new Set<string>();

  actionRequests.forEach((actionRequest, index) => {
    const candidates = toolCalls.filter(
      (toolCall) =>
        toolCall.name === actionRequest.name && !consumed.has(toolCall.id)
    );
    const match =
      candidates.find((toolCall) =>
        deepEqual(toolCall.args, actionRequest.args)
      ) ?? candidates[0];

    if (!match) {
      unmatched.push({ index, actionRequest });
      return;
    }
    consumed.add(match.id);
    byToolCallId.set(match.id, { index, actionRequest });
  });

  return { byToolCallId, unmatched };
}
