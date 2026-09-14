import type { Assistant, Client } from "@langchain/langgraph-sdk";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether the configured assistant id is a deployed assistant UUID rather than
 * a graph name. Graph names are used by local `langgraph dev` deployments.
 */
export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * HTTP status of an SDK error, when the request reached the server. Network
 * failures such as an unreachable deployment are plain TypeErrors and have no
 * status. The SDK's HTTPError is not part of its public API, so we duck-type
 * it and fall back to its message format.
 */
export function getHttpStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const { status } = error as { status?: unknown };
    if (typeof status === "number") return status;
  }

  const message = error instanceof Error ? error.message : "";
  const match = /^HTTP (\d{3}):/.exec(message);
  return match ? Number(match[1]) : undefined;
}

function pickDefaultAssistant(assistants: Assistant[]): Assistant | null {
  return (
    assistants.find(
      (assistant) => assistant.metadata?.["created_by"] === "system"
    ) ??
    assistants[0] ??
    null
  );
}

/**
 * Default assistant for a graph, or null when the graph exists but exposes no
 * assistant. Throws when the lookup fails, e.g. an unknown graph name or an
 * unreachable deployment.
 */
export async function findAssistantForGraph(
  client: Client,
  graphId: string
): Promise<Assistant | null> {
  const assistants = await client.assistants.search({ graphId, limit: 100 });
  return pickDefaultAssistant(assistants);
}

/**
 * Any usable assistant on the deployment, used to discover which graphs exist.
 * `graphId` is optional on the SDK side: omitting it drops graph_id from the
 * request body, so the server returns assistants across all graphs.
 */
export async function findFallbackAssistant(
  client: Client
): Promise<Assistant | null> {
  const assistants = await client.assistants.search({ limit: 100 });
  return pickDefaultAssistant(assistants);
}
