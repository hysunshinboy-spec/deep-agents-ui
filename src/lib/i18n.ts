export type Language = "zh" | "en";

/** Chinese is the default: the app ships for a zh-CN audience first. */
export const DEFAULT_LANGUAGE: Language = "zh";

export const LANGUAGE_LABELS: Record<Language, string> = {
  zh: "中文",
  en: "EN",
};

/** Key used to remember the choice across reloads. */
const LANGUAGE_STORAGE_KEY = "deep-agent-language";

export type TranslationParams = Record<string, string | number>;

const zh: Record<string, string> = {
  // Shared
  "common.loading": "加载中...",
  "common.cancel": "取消",
  "common.save": "保存",
  "common.edit": "编辑",
  "common.copy": "复制",
  "common.download": "下载",
  "common.arguments": "参数",
  "common.result": "结果",
  "common.input": "输入",
  "common.output": "输出",
  "common.close": "关闭",
  "common.toggleTasksPanel": "展开或收起任务面板",
  "common.toggleFilesPanel": "展开或收起文件面板",

  // Relative timestamps (artifacts panel)
  "time.justNow": "刚刚",
  "time.minutesAgo": "{n} 分钟前",
  "time.hoursAgo": "{n} 小时前",
  "time.daysAgo": "{n} 天前",

  // Language switcher
  "language.switch": "切换语言",

  // Theme switcher
  "theme.switch": "切换主题",
  "theme.teal": "青绿",
  "theme.sky": "晴空蓝",
  "theme.peach": "杏桃",

  // App shell
  "app.threads": "会话",
  "app.assistantLabel": "助手：",
  "app.settings": "设置",
  "app.newThread": "新建会话",
  "app.welcome": "欢迎使用独立聊天",
  "app.welcomeHint": "配置你的部署后即可开始",
  "app.openConfiguration": "打开配置",

  // Assistant resolution errors
  "errors.authFailed": "认证失败",
  "errors.authFailedDescription":
    "部署 {url} 拒绝了该 API 密钥。请在设置中检查 LangSmith API 密钥。",
  "errors.unreachable": "无法连接到部署",
  "errors.unreachableDescription":
    "{url} 无响应。请确认 LangGraph 服务正在运行，且部署地址填写正确。",
  "errors.noAssistants": "没有可用的助手",
  "errors.noAssistantsDescription":
    "部署 {url} 未注册任何助手，因此没有可对话的对象。",
  "errors.graphNotFound": '未找到图 "{id}"',
  "errors.graphNotFoundDescription":
    '已切换到 "{id}"。如果不是你想要的，请在设置中选择其他助手。',

  // Settings dialog
  "config.title": "配置",
  "config.description":
    "配置你的 LangGraph 部署信息。这些设置保存在浏览器本地存储中，并优先于环境变量。",
  "config.deploymentUrl": "部署地址",
  "config.assistantId": "助手 ID 或图名称",
  "config.assistantIdHint":
    "可以是助手 UUID，也可以是 `langgraph.json` 文件中 `graphs` 键对应的图名称。",
  "config.apiKey": "LangSmith API 密钥",
  "config.optional": "（可选）",
  "config.required": "部署地址和助手 ID 为必填项",
  "config.language": "语言",
  "config.theme": "主题",

  // Thread list
  "threads.title": "会话",
  "threads.allStatuses": "全部状态",
  "threads.groupActive": "活跃",
  "threads.groupAttention": "需关注",
  "threads.statusIdle": "空闲",
  "threads.statusBusy": "忙碌",
  "threads.statusInterrupted": "已中断",
  "threads.statusError": "错误",
  "threads.groupInterrupted": "需要关注",
  "threads.groupToday": "今天",
  "threads.groupYesterday": "昨天",
  "threads.groupWeek": "本周",
  "threads.groupOlder": "更早",
  "threads.yesterday": "昨天",
  "threads.failedToLoad": "加载会话失败",
  "threads.empty": "暂无会话",
  "threads.loadMore": "加载更多",
  "threads.closeSidebar": "关闭会话侧边栏",
  "threads.untitled": "未命名会话",
  "threads.fallbackTitle": "会话 {id}",
  "threads.delete": "删除",
  "threads.deleteTitle": "删除会话？",
  "threads.deleteDescription": "会话「{title}」将被永久删除，此操作无法撤销。",
  "threads.deleting": "删除中...",
  "threads.deleted": "会话已删除",
  "threads.deleteFailed": "删除会话失败：{error}",
  "threads.selectMode": "批量管理",
  "threads.exitSelectMode": "退出批量管理",
  "threads.selectionToolbar": "会话批量操作",
  "threads.selectedCount": "已选 {count} 个",
  "threads.selectAll": "全选",
  "threads.clearSelection": "取消全选",
  "threads.selectThread": "选择会话「{title}」",
  "threads.busyCannotDelete": "会话正在运行，无法删除",
  "threads.deleteSelected": "删除所选",
  "threads.deleteSelectedTitle": "删除所选的 {count} 个会话？",
  "threads.deleteSelectedDescription":
    "这 {count} 个会话将被永久删除，此操作无法撤销。",
  "threads.deletingProgress": "删除中…（{done}/{total}）",
  "threads.batchDeleted": "已删除 {count} 个会话",
  "threads.batchDeletePartial": "已删除 {success} 个，{failed} 个删除失败",
  "threads.batchDeletePartialDescription":
    "失败的会话仍处于选中状态，可直接重试。首个错误：{error}",
  "threads.batchDeleteAllFailed": "{count} 个会话全部删除失败",

  // Chat panel
  "chat.allTasksCompleted": "全部任务已完成",
  "chat.taskOf": "任务 {current} / {total}",
  "chat.tasks": "任务",
  "chat.filesState": "文件（状态）",
  "chat.placeholder": "输入消息...",
  "chat.placeholderRunning": "运行中...",
  "chat.send": "发送",
  "chat.stop": "停止",
  "chat.upload": "上传文档并转换为 markdown",
  "chat.uploading": "上传中 {progress}%",
  "chat.parsing": "解析中…",
  "chat.fetching": "取回结果…",
  "chat.uploadConverted": "已转换 {name}",
  "chat.uploadFailed": "转换失败：{error}",
  "chat.uploadWritebackFailed": "已转换，但写入会话失败：{error}",
  "chat.uploadQueued": "已转换 {name}，等本轮回复结束后自动写入会话",
  "chat.waitingForFile": "等文件解析完成后自动发送…",
  "chat.copy": "复制",
  "chat.copied": "已复制",

  // Agent tasks
  "tasks.heading": "智能体任务",
  "tasks.empty": "暂无任务",
  "tasks.statusPending": "待处理",
  "tasks.statusInProgress": "进行中",
  "tasks.statusCompleted": "已完成",

  // Right panel (artifacts & progress)
  "panel.artifacts": "产物",
  "panel.progress": "任务进度",

  // File system
  "files.heading": "文件系统",
  "files.empty": "暂无文件",
  "files.chars": "{count} 字",
  "files.viewerEmpty": "文件为空",
  "files.newFile": "新文件",
  "files.filenamePlaceholder": "输入文件名...",
  "files.contentPlaceholder": "输入文件内容...",
  "files.saveFailed": "保存文件失败：{error}",

  // Tool approval
  "approval.required": "需要审批",
  "approval.tool": "工具",
  "approval.editArguments": "编辑参数",
  "approval.rejectionMessage": "拒绝原因（可选）",
  "approval.rejectionPlaceholder": "说明拒绝该操作的原因...",
  "approval.saveAndApprove": "保存并批准",
  "approval.saving": "保存中...",
  "approval.confirmReject": "确认拒绝",
  "approval.rejecting": "拒绝中...",
  "approval.reject": "拒绝",
  "approval.approve": "批准",
  "approval.approving": "批准中...",
  "approval.statusApproved": "已批准",
  "approval.statusRejected": "已拒绝",
  "approval.statusEdited": "已修改并批准",
  "approval.undo": "撤销",
  "approval.batchProgress": "已决定 {done}/{total}，全部决定后自动提交",

  // Tool calls
  "tools.unknown": "未知工具",
  "tools.noResult": "暂无结果",
};

const en: Record<string, string> = {
  // Shared
  "common.loading": "Loading...",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.edit": "Edit",
  "common.copy": "Copy",
  "common.download": "Download",
  "common.arguments": "Arguments",
  "common.result": "Result",
  "common.input": "Input",
  "common.output": "Output",
  "common.close": "Close",
  "common.toggleTasksPanel": "Toggle tasks panel",
  "common.toggleFilesPanel": "Toggle files panel",

  // Relative timestamps (artifacts panel)
  "time.justNow": "just now",
  "time.minutesAgo": "{n} min ago",
  "time.hoursAgo": "{n} hr ago",
  "time.daysAgo": "{n} d ago",

  // Language switcher
  "language.switch": "Switch language",

  // Theme switcher
  "theme.switch": "Switch theme",
  "theme.teal": "Teal",
  "theme.sky": "Sky Blue",
  "theme.peach": "Peach",

  // App shell
  "app.threads": "Threads",
  "app.assistantLabel": "Assistant:",
  "app.settings": "Settings",
  "app.newThread": "New Thread",
  "app.welcome": "Welcome to Standalone Chat",
  "app.welcomeHint": "Configure your deployment to get started",
  "app.openConfiguration": "Open Configuration",

  // Assistant resolution errors
  "errors.authFailed": "Authentication failed",
  "errors.authFailedDescription":
    "The deployment at {url} rejected the API key. Check the LangSmith API key in Settings.",
  "errors.unreachable": "Cannot reach the deployment",
  "errors.unreachableDescription":
    "No response from {url}. Check that the LangGraph server is running and that the deployment URL is correct.",
  "errors.noAssistants": "No assistants available",
  "errors.noAssistantsDescription":
    "The deployment at {url} has no assistants registered, so there is nothing to chat with.",
  "errors.graphNotFound": 'Graph "{id}" was not found',
  "errors.graphNotFoundDescription":
    'Switched to "{id}". Choose a different one in Settings if that is not what you want.',

  // Settings dialog
  "config.title": "Configuration",
  "config.description":
    "Configure your LangGraph deployment settings. These settings are saved in your browser's local storage, and take precedence over the environment variables.",
  "config.deploymentUrl": "Deployment URL",
  "config.assistantId": "Assistant ID or Graph Name",
  "config.assistantIdHint":
    "Either an assistant UUID, or a graph name from the `graphs` key of your `langgraph.json` file.",
  "config.apiKey": "LangSmith API Key",
  "config.optional": "(Optional)",
  "config.required": "Deployment URL and Assistant ID are required",
  "config.language": "Language",
  "config.theme": "Theme",

  // Thread list
  "threads.title": "Threads",
  "threads.allStatuses": "All statuses",
  "threads.groupActive": "Active",
  "threads.groupAttention": "Attention",
  "threads.statusIdle": "Idle",
  "threads.statusBusy": "Busy",
  "threads.statusInterrupted": "Interrupted",
  "threads.statusError": "Error",
  "threads.groupInterrupted": "Requiring Attention",
  "threads.groupToday": "Today",
  "threads.groupYesterday": "Yesterday",
  "threads.groupWeek": "This Week",
  "threads.groupOlder": "Older",
  "threads.yesterday": "Yesterday",
  "threads.failedToLoad": "Failed to load threads",
  "threads.empty": "No threads found",
  "threads.loadMore": "Load More",
  "threads.closeSidebar": "Close threads sidebar",
  "threads.untitled": "Untitled Thread",
  "threads.fallbackTitle": "Thread {id}",
  "threads.delete": "Delete",
  "threads.deleteTitle": "Delete thread?",
  "threads.deleteDescription":
    'The thread "{title}" will be permanently deleted. This cannot be undone.',
  "threads.deleting": "Deleting...",
  "threads.deleted": "Thread deleted",
  "threads.deleteFailed": "Failed to delete thread: {error}",
  "threads.selectMode": "Select",
  "threads.exitSelectMode": "Exit selection",
  "threads.selectionToolbar": "Thread bulk actions",
  "threads.selectedCount": "{count} selected",
  "threads.selectAll": "Select all",
  "threads.clearSelection": "Clear selection",
  "threads.selectThread": 'Select thread "{title}"',
  "threads.busyCannotDelete": "Thread is running and cannot be deleted",
  "threads.deleteSelected": "Delete selected",
  "threads.deleteSelectedTitle": "Delete {count} threads?",
  "threads.deleteSelectedDescription":
    "These {count} threads will be permanently deleted. This cannot be undone.",
  "threads.deletingProgress": "Deleting… ({done}/{total})",
  "threads.batchDeleted": "Deleted {count} threads",
  "threads.batchDeletePartial": "Deleted {success}, {failed} failed",
  "threads.batchDeletePartialDescription":
    "Failed threads stay selected so you can retry. First error: {error}",
  "threads.batchDeleteAllFailed": "Failed to delete all {count} threads",

  // Chat panel
  "chat.allTasksCompleted": "All tasks completed",
  "chat.taskOf": "Task {current} of {total}",
  "chat.tasks": "Tasks",
  "chat.filesState": "Files (State)",
  "chat.placeholder": "Write your message...",
  "chat.placeholderRunning": "Running...",
  "chat.send": "Send",
  "chat.stop": "Stop",
  "chat.upload": "Upload a document and convert it to markdown",
  "chat.uploading": "Uploading {progress}%",
  "chat.parsing": "Parsing…",
  "chat.fetching": "Fetching result…",
  "chat.uploadConverted": "Converted {name}",
  "chat.uploadFailed": "Conversion failed: {error}",
  "chat.uploadWritebackFailed":
    "Converted, but writing to the thread failed: {error}",
  "chat.uploadQueued":
    "Converted {name}; will be written to the thread once this reply finishes",
  "chat.waitingForFile": "Will send once the file finishes parsing…",
  "chat.copy": "Copy",
  "chat.copied": "Copied",

  // Agent tasks
  "tasks.heading": "AGENT TASKS",
  "tasks.empty": "No tasks created yet",
  "tasks.statusPending": "Pending",
  "tasks.statusInProgress": "In Progress",
  "tasks.statusCompleted": "Completed",

  // Right panel (artifacts & progress)
  "panel.artifacts": "Artifacts",
  "panel.progress": "Progress",

  // File system
  "files.heading": "FILE SYSTEM",
  "files.empty": "No files created yet",
  "files.chars": "{count} chars",
  "files.viewerEmpty": "File is empty",
  "files.newFile": "New File",
  "files.filenamePlaceholder": "Enter filename...",
  "files.contentPlaceholder": "Enter file content...",
  "files.saveFailed": "Failed to save file: {error}",

  // Tool approval
  "approval.required": "Approval Required",
  "approval.tool": "Tool",
  "approval.editArguments": "Edit Arguments",
  "approval.rejectionMessage": "Rejection Message (optional)",
  "approval.rejectionPlaceholder":
    "Explain why you're rejecting this action...",
  "approval.saveAndApprove": "Save & Approve",
  "approval.saving": "Saving...",
  "approval.confirmReject": "Confirm Reject",
  "approval.rejecting": "Rejecting...",
  "approval.reject": "Reject",
  "approval.approve": "Approve",
  "approval.approving": "Approving...",
  "approval.statusApproved": "Approved",
  "approval.statusRejected": "Rejected",
  "approval.statusEdited": "Edited & Approved",
  "approval.undo": "Undo",
  "approval.batchProgress":
    "Decided {done}/{total}. Submits automatically once all are decided.",

  // Tool calls
  "tools.unknown": "Unknown Tool",
  "tools.noResult": "No Result Yet",
};

const DICTIONARIES: Record<Language, Record<string, string>> = { zh, en };

/**
 * Resolve a key for a given language. Unknown keys fall back to the default
 * language and then to the key itself, so a missing translation degrades to
 * something visible instead of throwing.
 */
export function translate(
  language: Language,
  key: string,
  params?: TranslationParams
): string {
  const template =
    DICTIONARIES[language][key] ?? DICTIONARIES[DEFAULT_LANGUAGE][key] ?? key;

  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name])
  );
}

function isLanguage(value: unknown): value is Language {
  return value === "zh" || value === "en";
}

/*
 * The language lives in a module-level store rather than React context so that
 * non-component callers (the `useThreads` fetcher) can read it too. Components
 * subscribe through `useSyncExternalStore` in `useI18n`.
 */
let currentLanguage: Language = DEFAULT_LANGUAGE;
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return currentLanguage;
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function setLanguage(language: Language): void {
  if (!isLanguage(language) || language === currentLanguage) return;
  currentLanguage = language;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Private mode or a blocked store: keep the in-memory choice.
    }
  }

  emit();
}

export function toggleLanguage(): void {
  setLanguage(currentLanguage === "zh" ? "en" : "zh");
}

/**
 * Load the stored choice. Runs after mount (never during SSR) so the server and
 * the first client render agree on the default and hydration stays clean.
 */
export function initLanguage(): void {
  if (typeof window === "undefined") return;

  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Ignore unreadable storage and keep the default.
  }

  if (isLanguage(stored) && stored !== currentLanguage) {
    currentLanguage = stored;
    emit();
  }
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
