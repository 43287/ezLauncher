import { create } from 'zustand';
import type { CollectionStep } from '../types';
import type { SessionStatus } from '../types/collector';

// 009: 采集会话状态机（data-model §5）

export interface CollectionSession {
  sessionId: string;
  itemId: string;
  effectiveTemplate: string;        // 经预设选择后的有效参数/命令模板
  steps: CollectionStep[];
  currentIndex: number;
  collected: Record<string, string>; // 占位符名 → 采集值
  dropPaths: string[] | null;
  status: SessionStatus;
}

interface CollectionState {
  session: CollectionSession | null;

  startSession: (s: Omit<CollectionSession, 'currentIndex' | 'collected' | 'status'> & {
    collected?: Record<string, string>;
    currentIndex?: number;
  }) => void;
  recordValue: (placeholder: string, value: string) => void;
  advance: () => void;
  complete: () => void;
  cancel: () => void;
  reset: () => void;
}

export const useCollectionStore = create<CollectionState>((set) => ({
  session: null,

  startSession: (s) =>
    set({
      session: {
        ...s,
        currentIndex: s.currentIndex ?? 0,
        collected: s.collected ?? {},
        status: 'running',
      },
    }),

  recordValue: (placeholder, value) =>
    set((state) => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          collected: { ...state.session.collected, [placeholder]: value },
        },
      };
    }),

  advance: () =>
    set((state) => {
      if (!state.session) return state;
      return {
        session: { ...state.session, currentIndex: state.session.currentIndex + 1 },
      };
    }),

  complete: () =>
    set((state) => {
      if (!state.session) return state;
      return { session: { ...state.session, status: 'completed' } };
    }),

  cancel: () =>
    set((state) => {
      if (!state.session) return state;
      return { session: { ...state.session, status: 'cancelled' } };
    }),

  reset: () => set({ session: null }),
}));
