import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "../../api/platform";
import { COLLECTOR_RESULT, COLLECTOR_CANCEL } from "../../constants/events";
import type { HistoryItem } from "../../components/collectors/CollectorShell";

// 009: 采集子窗口公共逻辑——解析 URL 参数、加载历史、发结果/取消。

export interface CollectorConfig {
  label?: string;
  options?: string[];
  initialValue?: string;
}

export interface CollectorParams {
  type: string;
  sessionId: string;
  stepId: string;
  placeholder: string;
  itemId: string;
  config: CollectorConfig;
}

export function parseCollectorParams(): CollectorParams {
  // hash 形如 #/collector/{type}?session=..&step=..&ph=..&item=..&cfg=..
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  const path = qIndex >= 0 ? hash.slice(0, qIndex) : hash;
  const query = qIndex >= 0 ? hash.slice(qIndex + 1) : "";
  const type = decodeURIComponent(path.replace(/^#\/collector\//, ""));
  const params = new URLSearchParams(query);
  let config: CollectorConfig = {};
  const cfgRaw = params.get("cfg");
  if (cfgRaw) {
    try {
      config = JSON.parse(cfgRaw) as CollectorConfig;
    } catch {
      config = {};
    }
  }
  return {
    type,
    sessionId: params.get("session") ?? "",
    stepId: params.get("step") ?? "",
    placeholder: params.get("ph") ?? "",
    itemId: params.get("item") ?? "",
    config,
  };
}

// 读取本采集窗口对应的历史（按 item + 采集器类型，最近优先）
export function useCollectorHistory(itemId: string, collectorType: string): HistoryItem[] {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const portable = await platform.getPortableMode();
        const json = await platform.loadHistory(portable);
        const map = json ? JSON.parse(json) : {};
        const entries = map?.[itemId]?.[collectorType] ?? [];
        if (!cancelled && Array.isArray(entries)) {
          // 已按 lastUsedAt 持久化，这里再保险排序
          const sorted = [...entries].sort(
            (a: { lastUsedAt?: number }, b: { lastUsedAt?: number }) =>
              (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0),
          );
          setHistory(sorted.map((e: { value: string; display?: string }) => ({ value: e.value, display: e.display })));
        }
      } catch {
        /* 无历史 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, collectorType]);
  return history;
}

// 仅隐藏自身（解除置顶透明窗口对鼠标的拦截），但【绝不】在这里 close。
// 原因：子窗口自己 close() 会触发 tauri://destroyed，可能抢在 COLLECTOR_RESULT 事件
// 之前到达协调者，使结果被误判为"取消"而丢弃（{selected_path}/target_process 收不到）。
// 销毁统一交给协调者在记录结果之后执行，从根上消除该竞态。
async function hideSelf(): Promise<void> {
  try {
    await getCurrentWindow().hide();
  } catch {
    /* ignore */
  }
}

// 发结果 → 先把结果发出（关键），再隐藏自身；不 close，由协调者销毁
export async function emitResult(p: CollectorParams, value: string, display?: string): Promise<void> {
  try {
    await emit(COLLECTOR_RESULT, {
      sessionId: p.sessionId,
      stepId: p.stepId,
      collectorType: p.type,
      value,
      display,
    });
  } catch {
    /* ignore */
  }
  await hideSelf();
}

// 发取消 → 同上：先发取消事件，再隐藏；销毁交给协调者
export async function emitCancel(p: CollectorParams): Promise<void> {
  try {
    await emit(COLLECTOR_CANCEL, { sessionId: p.sessionId, stepId: p.stepId });
  } catch {
    /* ignore */
  }
  await hideSelf();
}
