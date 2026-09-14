export interface StandaloneConfig {
  deploymentUrl: string;
  assistantId: string;
  langsmithApiKey?: string;
}

const CONFIG_KEY = "deep-agent-config";

/**
 * Defaults for talking to a deployment without opening the settings dialog.
 * NEXT_PUBLIC_* values are inlined when the dev server or a build starts, so
 * changing them requires a restart.
 */
const DEFAULT_DEPLOYMENT_URL = process.env.NEXT_PUBLIC_DEPLOYMENT_URL;
const DEFAULT_ASSISTANT_ID = process.env.NEXT_PUBLIC_ASSISTANT_ID;

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Env-only defaults. The object is shared so that passing it as
 * `initialConfig` does not retrigger the settings dialog effect on every
 * render, which would reset whatever the user is typing.
 */
const DEFAULT_CONFIG: StandaloneConfig = {
  deploymentUrl: readString(DEFAULT_DEPLOYMENT_URL) ?? "",
  assistantId: readString(DEFAULT_ASSISTANT_ID) ?? "",
};

export function getDefaultConfig(): StandaloneConfig {
  return DEFAULT_CONFIG;
}

function readStoredConfig(): Partial<StandaloneConfig> | null {
  const stored = window.localStorage.getItem(CONFIG_KEY);
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as Partial<StandaloneConfig>;
  } catch {
    return null;
  }
}

/**
 * Config used to talk to the deployment. Values saved from the settings dialog
 * win over the env defaults, and empty saved fields fall back to the env
 * value. Returns null only when the deployment URL or the assistant id cannot
 * be resolved from either source, which keeps the first-run welcome page.
 *
 * This is a pure read: it is called from render paths such as the SWR key in
 * `useThreads`, so it must never write to storage.
 */
export function getConfig(): StandaloneConfig | null {
  if (typeof window === "undefined") return null;

  const stored = readStoredConfig();
  const deploymentUrl =
    readString(stored?.deploymentUrl) ?? readString(DEFAULT_DEPLOYMENT_URL);
  const assistantId =
    readString(stored?.assistantId) ?? readString(DEFAULT_ASSISTANT_ID);

  if (!deploymentUrl || !assistantId) return null;

  return {
    deploymentUrl,
    assistantId,
    // Left undefined so the existing `|| process.env.NEXT_PUBLIC_...` fallback
    // in page.tsx and useThreads.ts stays the single source for this key.
    langsmithApiKey: readString(stored?.langsmithApiKey),
  };
}

export function saveConfig(config: StandaloneConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
