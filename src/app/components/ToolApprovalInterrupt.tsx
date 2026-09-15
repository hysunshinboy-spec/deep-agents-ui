"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Check, X, Pencil } from "lucide-react";
import type {
  ActionRequest,
  ApprovalDecision,
  ReviewConfig,
} from "@/app/types/types";
import { useI18n } from "@/providers/I18nProvider";
import { cn } from "@/lib/utils";

interface ToolApprovalInterruptProps {
  actionRequest: ActionRequest;
  /** Position in the interrupt's action_requests; orders the submitted batch. */
  index: number;
  reviewConfig?: ReviewConfig;
  decision?: ApprovalDecision;
  onDecide: (index: number, decision: ApprovalDecision) => void;
  onUndo?: (index: number) => void;
  isLoading?: boolean;
}

export function ToolApprovalInterrupt({
  actionRequest,
  index,
  reviewConfig,
  decision,
  onDecide,
  onUndo,
  isLoading,
}: ToolApprovalInterruptProps) {
  const { t } = useI18n();
  const [rejectionMessage, setRejectionMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedArgs, setEditedArgs] = useState<Record<string, unknown>>({});
  const [showRejectionInput, setShowRejectionInput] = useState(false);

  // Backend field names — the wire format is snake_case.
  const allowedDecisions = reviewConfig?.allowed_decisions ?? [
    "approve",
    "reject",
    "edit",
  ];

  const isDecided = decision !== undefined;
  const shownArgs =
    decision?.type === "edit" ? decision.editedAction.args : actionRequest.args;

  const handleApprove = () => {
    onDecide(index, { type: "approve" });
  };

  const handleRejectConfirm = () => {
    onDecide(index, { type: "reject", message: rejectionMessage.trim() });
  };

  const handleEdit = () => {
    onDecide(index, {
      type: "edit",
      editedAction: { name: actionRequest.name, args: editedArgs },
    });
    setIsEditing(false);
    setEditedArgs({});
  };

  const startEditing = () => {
    setIsEditing(true);
    // Re-editing an existing decision keeps that edit instead of discarding it.
    setEditedArgs(
      JSON.parse(
        JSON.stringify(
          decision?.type === "edit"
            ? decision.editedAction.args
            : actionRequest.args
        )
      )
    );
    setShowRejectionInput(false);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedArgs({});
  };

  const updateEditedArg = (key: string, value: string) => {
    try {
      const parsedValue =
        value.trim().startsWith("{") || value.trim().startsWith("[")
          ? JSON.parse(value)
          : value;
      setEditedArgs((prev) => ({ ...prev, [key]: parsedValue }));
    } catch {
      setEditedArgs((prev) => ({ ...prev, [key]: value }));
    }
  };

  const decidedLabel =
    decision?.type === "approve"
      ? t("approval.statusApproved")
      : decision?.type === "reject"
      ? t("approval.statusRejected")
      : t("approval.statusEdited");

  const decidedIcon =
    decision?.type === "approve" ? (
      <Check size={14} />
    ) : decision?.type === "reject" ? (
      <X size={14} />
    ) : (
      <Pencil size={14} />
    );

  return (
    <div className="w-full rounded-md border border-border bg-muted/30 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2 text-foreground">
        <AlertCircle
          size={16}
          className="text-[var(--color-warning)]"
        />
        <span className="text-xs font-semibold uppercase tracking-wider">
          {t("approval.required")}
        </span>
      </div>

      {/* Description */}
      {actionRequest.description && (
        <p className="mb-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {actionRequest.description}
        </p>
      )}

      {/* Tool Info Card */}
      <div className="mb-4 rounded-sm border border-border bg-background p-3">
        <div className="mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("approval.tool")}
          </span>
          <p className="mt-1 font-mono text-sm font-medium text-foreground">
            {actionRequest.name}
          </p>
        </div>

        {isEditing ? (
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("approval.editArguments")}
            </span>
            <div className="mt-2 space-y-3">
              {Object.entries(shownArgs).map(([key, value]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    {key}
                  </label>
                  <Textarea
                    value={
                      editedArgs[key] !== undefined
                        ? typeof editedArgs[key] === "string"
                          ? (editedArgs[key] as string)
                          : JSON.stringify(editedArgs[key], null, 2)
                        : typeof value === "string"
                        ? value
                        : JSON.stringify(value, null, 2)
                    }
                    onChange={(e) => updateEditedArg(key, e.target.value)}
                    className="font-mono text-xs"
                    rows={
                      typeof value === "string" && value.length < 100 ? 2 : 4
                    }
                    disabled={isLoading}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("common.arguments")}
            </span>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-sm border border-border bg-muted/40 p-2 font-mono text-xs text-foreground">
              {JSON.stringify(shownArgs, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Rejection Message Input */}
      {showRejectionInput && !isEditing && !isDecided && (
        <div className="mb-4">
          <label className="mb-2 block text-xs font-medium text-foreground">
            {t("approval.rejectionMessage")}
          </label>
          <Textarea
            value={rejectionMessage}
            onChange={(e) => setRejectionMessage(e.target.value)}
            placeholder={t("approval.rejectionPlaceholder")}
            className="text-sm"
            rows={2}
            disabled={isLoading}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {isDecided ? (
          <>
            <span
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium",
                decision?.type === "reject"
                  ? "text-destructive"
                  : "text-[var(--color-success)]"
              )}
            >
              {decidedIcon}
              {decidedLabel}
            </span>
            {onUndo && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUndo(index)}
                disabled={isLoading}
              >
                {t("approval.undo")}
              </Button>
            )}
          </>
        ) : isEditing ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={cancelEditing}
              disabled={isLoading}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleEdit}
              disabled={isLoading}
              className="bg-[var(--color-approve)] text-white hover:bg-[var(--color-approve-hover)]"
            >
              <Check size={14} />
              {isLoading ? t("approval.saving") : t("approval.saveAndApprove")}
            </Button>
          </>
        ) : showRejectionInput ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowRejectionInput(false);
                setRejectionMessage("");
              }}
              disabled={isLoading}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectConfirm}
              disabled={isLoading}
            >
              {isLoading
                ? t("approval.rejecting")
                : t("approval.confirmReject")}
            </Button>
          </>
        ) : (
          <>
            {allowedDecisions.includes("reject") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRejectionInput(true)}
                disabled={isLoading}
                className="text-destructive hover:bg-destructive/10"
              >
                <X size={14} />
                {t("approval.reject")}
              </Button>
            )}
            {allowedDecisions.includes("edit") && (
              <Button
                variant="outline"
                size="sm"
                onClick={startEditing}
                disabled={isLoading}
              >
                <Pencil size={14} />
                {t("common.edit")}
              </Button>
            )}
            {allowedDecisions.includes("approve") && (
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isLoading}
                className={cn(
                  "bg-[var(--color-approve)] text-white hover:bg-[var(--color-approve-hover)]"
                )}
              >
                <Check size={14} />
                {isLoading ? t("approval.approving") : t("approval.approve")}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
