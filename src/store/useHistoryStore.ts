import { create } from 'zustand';
import { platform } from '../api/platform';
import { useToastStore } from './useToastStore';
import { PERSIST_DEBOUNCE_MS } from '../constants/storage';

// 便携标志缓存：复用与 useDataStore 一致的来源（启动流程注入）
let cachedPortable = true;
export const setHistoryCachedPortable = (portable: boolean) => {
  cachedPortable = portable;
};

// 009: 采集历史记录 store（按「item + 采集器类型」LRU）
// data-model §4，research R8。LRU 纯逻辑导出以便单测（T011）。

export interface HistoryEntry {
  value: string;        // 可复用表示（进程存名而非 PID）
  display?: string;     // 展示文案
  lastUsedAt: number;   // 最近使用时间戳（毫秒）
}

// itemId → collectorType → HistoryEntry[]
export type HistoryMap = Record<string, Record<string, HistoryEntry[]>>;

// 纯逻辑：插入/复用一个值，最近优先、同值去重置顶、超 limit 截断。
export function upsertEntry(
  list: HistoryEntry[] | undefined,
  value: string,
  display: string | undefined,
  now: number,
  limit: number,
): HistoryEntry[] {
  const base = (list ?? []).filter((e) => e.value !== value); // 去重
  const entry: HistoryEntry = { value, display, lastUsedAt: now };
  const next = [entry, ...base];                                // 置顶
  next.sort((a, b) => b.lastUsedAt - a.lastUsedAt);             // 最近优先
  return next.slice(0, Math.max(0, limit));                     // 上限截断
}

export function getEntries(
  map: HistoryMap,
  itemId: string,
  collectorType: string,
): HistoryEntry[] {
  return map[itemId]?.[collectorType] ?? [];
}

interface HistoryState {
  history: HistoryMap;
  limit: number;
  isLoaded: boolean;

  setLimit: (limit: number) => void;
  setHistory: (history: HistoryMap) => void;
  setIsLoaded: (loaded: boolean) => void;

  get: (itemId: string, collectorType: string) => HistoryEntry[];
  add: (itemId: string, collectorType: string, value: string, display?: string, now?: number) => void;
  clear: () => void;
  clearFor: (itemId: string, collectorType?: string) => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  history: {},
  limit: 10,
  isLoaded: false,

  setLimit: (limit) => set({ limit }),
  setHistory: (history) => set({ history }),
  setIsLoaded: (loaded) => set({ isLoaded: loaded }),

  get: (itemId, collectorType) => getEntries(get().history, itemId, collectorType),

  add: (itemId, collectorType, value, display, now) => {
    if (!value) return;
    const ts = now ?? Date.now();
    set((state) => {
      const forItem = state.history[itemId] ?? {};
      const updated = upsertEntry(forItem[collectorType], value, display, ts, state.limit);
      return {
        history: {
          ...state.history,
          [itemId]: { ...forItem, [collectorType]: updated },
        },
      };
    });
  },

  clear: () => set({ history: {} }),

  clearFor: (itemId, collectorType) => {
    set((state) => {
      if (!state.history[itemId]) return state;
      if (!collectorType) {
        const next = { ...state.history };
        delete next[itemId];
        return { history: next };
      }
      const forItem = { ...state.history[itemId] };
      delete forItem[collectorType];
      return { history: { ...state.history, [itemId]: forItem } };
    });
  },
}));

// 从后端加载历史（启动时调用，须在 setIsLoaded(true) 前完成，避免回写空数据）
export async function loadHistoryFromBackend(portable: boolean): Promise<void> {
  try {
    const json = await platform.loadHistory(portable);
    const parsed = json ? JSON.parse(json) : {};
    if (parsed && typeof parsed === 'object') {
      useHistoryStore.getState().setHistory(parsed as HistoryMap);
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  } finally {
    useHistoryStore.getState().setIsLoaded(true);
  }
}

// 持久化订阅：仿 useDataStore 的防抖写入（data-model §4，复用 PERSIST_DEBOUNCE_MS）
let historySaveTimeout: ReturnType<typeof setTimeout> | null = null;
useHistoryStore.subscribe((state, prevState) => {
  if (!state.isLoaded) return;
  if (state.history === prevState.history) return;
  if (historySaveTimeout) clearTimeout(historySaveTimeout);
  historySaveTimeout = setTimeout(async () => {
    try {
      await platform.saveHistory(cachedPortable, JSON.stringify(state.history));
    } catch (err) {
      console.error('Failed to save history:', err);
      useToastStore.getState().addToast(`保存历史记录失败 (IO_ERROR): ${err}`, 'error');
    }
  }, PERSIST_DEBOUNCE_MS);
});
