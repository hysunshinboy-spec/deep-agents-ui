export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "pending" | "completed" | "error" | "interrupted";
}

export interface SubAgent {
  id: string;
  name: string;
  subAgentName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: "pending" | "active" | "completed" | "error";
}

export interface FileItem {
  path: string;
  content: string;
}

/**
 * Shape of a single entry in the agent's `files` state channel.
 *
 * Mirrors `FileData` in deepagents (`deepagents/backends/protocol.py`). The
 * channel is backed by a delta reducer that merges per-key writes, so an
 * update only needs to carry the files it touches — and a `null` value deletes
 * a key rather than storing a null.
 */
export interface FileData {
  content: string;
  /** `"utf-8"` for text, `"base64"` for binary. */
  encoding: string;
  created_at?: string;
  modified_at?: string;
}

/** The `files` channel, keyed by absolute path inside the virtual filesystem. */
export type FileMap = Record<string, FileData>;

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  updatedAt?: Date;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterruptData {
  value: any;
  ns?: string[];
  scope?: string;
}

export interface ActionRequest {
  name: string;
  args: Record<string, unknown>;
  description?: string;
}

/** Field names match the wire format of the backend's HITLRequest. */
export interface ReviewConfig {
  action_name: string;
  allowed_decisions?: string[];
}

export type ApprovalDecision =
  | { type: "approve" }
  | { type: "reject"; message?: string }
  | {
      type: "edit";
      editedAction: { name: string; args: Record<string, unknown> };
    };

/**
 * An action request paired with its position in `interrupt.value.action_requests`.
 * The backend requires one decision per request, in that order, submitted
 * together — so the index, not the tool call id, is what orders the payload.
 */
export interface ApprovalSlot {
  index: number;
  actionRequest: ActionRequest;
}

export interface ToolApprovalInterruptData {
  action_requests: ActionRequest[];
  review_configs?: ReviewConfig[];
}
