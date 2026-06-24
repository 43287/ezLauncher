// 009: 采集流程运行态类型（前端内存，data-model §5）

import type { CollectionStep } from "../types";

export type CollectorType = "process" | "file" | "directory" | "text" | "list" | "drop";

export type SessionStatus = "idle" | "running" | "cancelled" | "completed";

// 采集子窗口 → 协调者：结果事件载荷
export interface CollectorResultPayload {
  sessionId: string;
  stepId: string;
  collectorType: string;
  value: string;
  display?: string;
}

// 采集子窗口 → 协调者：取消事件载荷
export interface CollectorCancelPayload {
  sessionId: string;
  stepId: string;
}

// 协调者 → 子窗口：初始化载荷（也可经 URL 传递）
export interface CollectorInitPayload {
  sessionId: string;
  step: CollectionStep;
  history: { value: string; display?: string }[];
  initialValue?: string;
}
