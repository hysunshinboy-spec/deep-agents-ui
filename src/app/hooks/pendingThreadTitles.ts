"use client";

// 会话标题的本地占位存储。
//
// 服务端要等 run 往 thread values 里写出消息后才能从首条 human 消息推出标题，
// 这期间（组字、文件解析、agent 还在跑）侧边栏一直是「未命名会话」。
// 发送消息时把首条消息的摘要先记到这里，useThreads 合并列表数据时顶上；
// 服务端标题一旦出现，占位条目即被忽略，无需清理（ Map 只随会话 id 增长，
// 且只在服务端暂时没标题的窗口内被读取）。
const titles = new Map<string, string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function setPendingThreadTitle(threadId: string, title: string) {
  if (titles.get(threadId) === title) return;
  titles.set(threadId, title);
  notify();
}

export function getPendingThreadTitle(threadId: string): string | undefined {
  return titles.get(threadId);
}

/** 订阅标题变化，返回取消订阅函数。 */
export function subscribePendingThreadTitles(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
