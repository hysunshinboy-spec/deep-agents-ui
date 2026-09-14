"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "@langchain/langgraph-sdk";
import type {
  ActionRequest,
  ApprovalDecision,
  ReviewConfig,
  ToolCall,
} from "@/app/types/types";
import { matchActionRequests } from "@/app/utils/utils";

interface ToolApprovalParams {
  interrupt: unknown;
  messages: { message: Message; toolCalls: ToolCall[] }[];
  isLoading: boolean;
  resumeInterrupt: (value: unknown) => void;
}

/**
 * Collect approval decisions for every action request in the pending interrupt
 * and submit them in one payload.
 *
 * The backend requires exactly one decision per action request, in the order it
 * sent them, in a single resume — a partial batch raises and kills the run. So
 * decisions are keyed by action request index rather than by tool call, and the
 * payload is rebuilt from that index order regardless of click order.
 */
export function useToolApproval({
  interrupt,
  messages,
  isLoading,
  resumeInterrupt,
}: ToolApprovalParams) {
  // The stream's `interrupt` getter can return a single interrupt, an array of
  // them, or a value-less breakpoint marker. Normalize to the first entry that
  // actually carries action requests.
  const request = useMemo(() => {
    const candidates = Array.isArray(interrupt) ? interrupt : [interrupt];
    for (const candidate of candidates) {
      const value = (candidate as { value?: unknown } | null | undefined)
        ?.value;
      if (!value || typeof value !== "object") continue;
      const actionRequests = (value as { action_requests?: unknown })
        .action_requests;
      if (!Array.isArray(actionRequests) || actionRequests.length === 0)
        continue;
      const reviewConfigs = (value as { review_configs?: unknown })
        .review_configs;
      return {
        actionRequests: actionRequests as ActionRequest[],
        reviewConfigs: Array.isArray(reviewConfigs)
          ? (reviewConfigs as ReviewConfig[])
          : [],
      };
    }
    return {
      actionRequests: [] as ActionRequest[],
      reviewConfigs: [] as ReviewConfig[],
    };
  }, [interrupt]);

  // Review configs are per tool name, so several action requests for the same
  // tool share one entry.
  const reviewConfigsByToolName = useMemo(() => {
    const map = new Map<string, ReviewConfig>();
    for (const config of request.reviewConfigs) {
      if (config?.action_name) map.set(config.action_name, config);
    }
    return map;
  }, [request]);

  // The approval cards hang off the newest AI message that called one of the
  // interrupted tools. Deliberately not "the last message": a message sent
  // while an interrupt is pending becomes the last one and would hide the cards.
  const hostMessageId = useMemo(() => {
    const names = new Set(request.actionRequests.map((item) => item.name));
    if (names.size === 0) return undefined;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const entry = messages[index];
      if (entry.message.type !== "ai") continue;
      if (!entry.message.id) continue;
      if (entry.toolCalls.some((toolCall) => names.has(toolCall.name))) {
        return entry.message.id;
      }
    }
    return undefined;
  }, [messages, request]);

  const hostToolCalls = useMemo(() => {
    if (!hostMessageId) return [];
    return (
      messages.find((entry) => entry.message.id === hostMessageId)?.toolCalls ??
      []
    );
  }, [messages, hostMessageId]);

  const { byToolCallId, unmatched } = useMemo(
    () => matchActionRequests(hostToolCalls, request.actionRequests),
    [hostToolCalls, request]
  );

  const [decisions, setDecisions] = useState<Map<number, ApprovalDecision>>(
    new Map()
  );
  const submittingRef = useRef(false);

  // Clear once per pending batch. The interrupt id identifies a batch: it is
  // stable while the run is paused (so clicks mid-batch survive re-renders) and
  // differs for the next one. Falling back to names keeps this working if the
  // id is ever absent — an upstream change there would need a new approach.
  const signature = request.actionRequests.map((item) => item.name).join("|");
  const resetKey =
    (Array.isArray(interrupt)
      ? undefined
      : (interrupt as { id?: string })?.id) ?? signature;

  useEffect(() => {
    setDecisions(new Map());
    submittingRef.current = false;
  }, [resetKey]);

  const submit = useCallback(
    (all: Map<number, ApprovalDecision>) => {
      if (submittingRef.current) return;
      const payload = request.actionRequests.map((_, index) => all.get(index));
      if (payload.some((decision) => decision === undefined)) return;
      submittingRef.current = true;
      resumeInterrupt({ decisions: payload });
    },
    [request, resumeInterrupt]
  );

  // `submit` runs in the handler, never inside a state updater: React 19
  // double-invokes updaters in development, which would resume twice.
  const decide = useCallback(
    (index: number, decision: ApprovalDecision) => {
      if (submittingRef.current) return;
      const next = new Map(decisions);
      next.set(index, decision);
      setDecisions(next);
      if (next.size === request.actionRequests.length) submit(next);
    },
    [decisions, request, submit]
  );

  const undo = useCallback((index: number) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      next.delete(index);
      return next;
    });
  }, []);

  return {
    actionRequests: request.actionRequests,
    reviewConfigsByToolName,
    hostMessageId,
    byToolCallId,
    unmatched,
    decisions,
    isLoading,
    decide,
    undo,
  };
}
