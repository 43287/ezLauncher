import { create } from 'zustand';
import { generateId } from '../constants/ids';
import { TOAST_AUTO_DISMISS_MS } from '../constants/storage';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastState {
  toasts: ToastMessage[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

// 存储 toast 自动消失定时器，支持 removeToast 提前清理（FR-015）
const timeoutMap = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = generateId();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
    const timer = setTimeout(() => {
      timeoutMap.delete(id);
      set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
      }));
    }, TOAST_AUTO_DISMISS_MS);
    timeoutMap.set(id, timer);
  },
  removeToast: (id) => {
    const timer = timeoutMap.get(id);
    if (timer) {
      clearTimeout(timer);
      timeoutMap.delete(id);
    }
    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  }
}));
