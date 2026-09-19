"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { useQueryState } from "nuqs";
import {
  getConfig,
  getDefaultConfig,
  saveConfig,
  StandaloneConfig,
} from "@/lib/config";
import {
  findAssistantForGraph,
  findFallbackAssistant,
  getHttpStatus,
  isUuid,
} from "@/lib/assistants";
import { ConfigDialog } from "@/app/components/ConfigDialog";
import { Button } from "@/components/ui/button";
import { Assistant } from "@langchain/langgraph-sdk";
import { ClientProvider, useClient } from "@/providers/ClientProvider";
import { useI18n } from "@/providers/I18nProvider";
import { Settings, MessagesSquare, SquarePen } from "lucide-react";
import { toast } from "sonner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ThreadList } from "@/app/components/ThreadList";
import { ChatProvider } from "@/providers/ChatProvider";
import { ChatInterface } from "@/app/components/ChatInterface";
import { ArtifactsPanel } from "@/app/components/ArtifactsPanel";

// Stable id so that repeated resolutions replace the previous toast instead of
// stacking, including the double invocation of effects in React strict mode.
const ASSISTANT_STATUS_TOAST_ID = "assistant-status";

interface HomePageInnerProps {
  config: StandaloneConfig;
  configDialogOpen: boolean;
  setConfigDialogOpen: (open: boolean) => void;
  handleSaveConfig: (config: StandaloneConfig) => void;
}

function HomePageInner({
  config,
  configDialogOpen,
  setConfigDialogOpen,
  handleSaveConfig,
}: HomePageInnerProps) {
  const client = useClient();
  const { t } = useI18n();
  const [threadId, setThreadId] = useQueryState("threadId");
  const [sidebar, setSidebar] = useQueryState("sidebar");

  const [mutateThreads, setMutateThreads] = useState<(() => void) | null>(null);
  const [interruptCount, setInterruptCount] = useState(0);
  const [assistant, setAssistant] = useState<Assistant | null>(null);

  // Ref so the recovery callback can merge into the latest config without
  // adding `config` to fetchAssistant's dependencies.
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const reportAssistantFailure = useCallback(
    (error: unknown) => {
      const status = getHttpStatus(error);

      if (status === 401 || status === 403) {
        toast.error(t("errors.authFailed"), {
          id: ASSISTANT_STATUS_TOAST_ID,
          description: t("errors.authFailedDescription", {
            url: config.deploymentUrl,
          }),
        });
        return;
      }

      toast.error(t("errors.unreachable"), {
        id: ASSISTANT_STATUS_TOAST_ID,
        description: t("errors.unreachableDescription", {
          url: config.deploymentUrl,
        }),
      });
    },
    [config.deploymentUrl, t]
  );

  const handleAssistantRecovered = useCallback(
    (nextAssistantId: string) => {
      const current = configRef.current;
      // Also the guard that keeps the effect from looping: there is nothing to
      // persist once the configured id resolves to this assistant.
      if (current.assistantId === nextAssistantId) return;

      handleSaveConfig({ ...current, assistantId: nextAssistantId });
    },
    [handleSaveConfig]
  );

  const fetchAssistant = useCallback(async () => {
    const requestedId = config.assistantId;

    try {
      const resolved = isUuid(requestedId)
        ? await client.assistants.get(requestedId)
        : await findAssistantForGraph(client, requestedId);

      if (resolved) {
        setAssistant(resolved);
        return;
      }
      // The graph exists but exposes no assistant we can use. Fall through and
      // look for another graph that does.
    } catch (error) {
      if (getHttpStatus(error) !== 404) {
        console.error("Failed to reach the deployment:", error);
        setAssistant(null);
        reportAssistantFailure(error);
        return;
      }
      // 404: the configured graph name or assistant id does not exist on this
      // deployment. Fall through to recovery rather than fabricating an
      // assistant that would only fail later, when a run is submitted.
    }

    try {
      const fallback = await findFallbackAssistant(client);

      if (!fallback) {
        setAssistant(null);
        toast.error(t("errors.noAssistants"), {
          id: ASSISTANT_STATUS_TOAST_ID,
          description: t("errors.noAssistantsDescription", {
            url: config.deploymentUrl,
          }),
        });
        return;
      }

      setAssistant(fallback);
      // Persist the graph name rather than the assistant UUID: thread listing
      // only filters by assistant id for UUIDs, and graph names survive
      // restarts.
      handleAssistantRecovered(fallback.graph_id);
      toast.warning(t("errors.graphNotFound", { id: requestedId }), {
        id: ASSISTANT_STATUS_TOAST_ID,
        description: t("errors.graphNotFoundDescription", {
          id: fallback.graph_id,
        }),
      });
    } catch (error) {
      console.error("Failed to list assistants:", error);
      setAssistant(null);
      reportAssistantFailure(error);
    }
  }, [
    client,
    config.assistantId,
    config.deploymentUrl,
    handleAssistantRecovered,
    reportAssistantFailure,
    t,
  ]);

  useEffect(() => {
    fetchAssistant();
  }, [fetchAssistant]);

  return (
    <>
      <ConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        onSave={handleSaveConfig}
        initialConfig={config}
      />
      <div className="flex h-screen flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">测试助手</h1>
            {!sidebar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebar("1")}
                className="rounded-md border border-border bg-card p-3 text-foreground hover:bg-accent"
              >
                <MessagesSquare className="mr-2 h-4 w-4" />
                {t("app.threads")}
                {interruptCount > 0 && (
                  <span className="ml-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
                    {interruptCount}
                  </span>
                )}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{t("app.assistantLabel")}</span>{" "}
              {config.assistantId}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigDialogOpen(true)}
            >
              <Settings className="mr-2 h-4 w-4" />
              {t("app.settings")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setThreadId(null)}
              disabled={!threadId}
              className="border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] text-white hover:bg-[var(--color-accent-strong-hover)]"
            >
              <SquarePen className="mr-2 h-4 w-4" />
              {t("app.newThread")}
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <ChatProvider
            activeAssistant={assistant}
            onHistoryRevalidate={() => mutateThreads?.()}
          >
            <ResizablePanelGroup
              direction="horizontal"
              autoSaveId="standalone-chat-v2"
            >
              {sidebar && (
                <>
                  <ResizablePanel
                    id="thread-history"
                    order={1}
                    defaultSize={25}
                    minSize={14}
                    className="relative min-w-[260px]"
                  >
                    <ThreadList
                      onThreadSelect={async (id) => {
                        await setThreadId(id);
                      }}
                      onMutateReady={(fn) => setMutateThreads(() => fn)}
                      onClose={() => setSidebar(null)}
                      onInterruptCountChange={setInterruptCount}
                    />
                  </ResizablePanel>
                  <ResizableHandle />
                </>
              )}

              <ResizablePanel
                id="chat"
                className="relative flex flex-col"
                order={2}
              >
                <ChatInterface assistant={assistant} />
              </ResizablePanel>

              <ResizableHandle />

              {/* 产物 + 任务进度面板；Provider 上移到面板组这一层，
                  让右侧面板也能消费 chat context（files/todos/setFiles）。 */}
              <ResizablePanel
                id="artifacts"
                order={3}
                defaultSize={18}
                minSize={12}
                maxSize={32}
                className="min-w-[240px] bg-[var(--color-muted-secondary)]/40"
              >
                <ArtifactsPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ChatProvider>
        </div>
      </div>
    </>
  );
}

function HomePageContent() {
  const { t } = useI18n();
  const [config, setConfig] = useState<StandaloneConfig | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [assistantId, setAssistantId] = useQueryState("assistantId");

  // On mount, check for saved config, otherwise show config dialog
  useEffect(() => {
    const savedConfig = getConfig();
    if (savedConfig) {
      setConfig(savedConfig);
      if (!assistantId) {
        setAssistantId(savedConfig.assistantId);
      }
    } else {
      setConfigDialogOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL in sync with the configured assistant, including after a
  // recovery changed it in the background.
  useEffect(() => {
    if (config && config.assistantId !== assistantId) {
      setAssistantId(config.assistantId);
    }
  }, [config, assistantId, setAssistantId]);

  const handleSaveConfig = useCallback((newConfig: StandaloneConfig) => {
    saveConfig(newConfig);
    setConfig(newConfig);
  }, []);

  const langsmithApiKey =
    config?.langsmithApiKey || process.env.NEXT_PUBLIC_LANGSMITH_API_KEY || "";

  if (!config) {
    return (
      <>
        <ConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          onSave={handleSaveConfig}
          initialConfig={getDefaultConfig()}
        />
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">{t("app.welcome")}</h1>
            <p className="mt-2 text-muted-foreground">{t("app.welcomeHint")}</p>
            <Button
              onClick={() => setConfigDialogOpen(true)}
              className="mt-4"
            >
              {t("app.openConfiguration")}
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <ClientProvider
      deploymentUrl={config.deploymentUrl}
      apiKey={langsmithApiKey}
    >
      <HomePageInner
        config={config}
        configDialogOpen={configDialogOpen}
        setConfigDialogOpen={setConfigDialogOpen}
        handleSaveConfig={handleSaveConfig}
      />
    </ClientProvider>
  );
}

export default function HomePage() {
  const { t } = useI18n();

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
