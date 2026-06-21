import { create } from 'zustand';
import { useDataStore } from './useDataStore';

interface UIState {
  activeLeftTab: string;
  activeTopTab: string;
  isRecordingShortcut: boolean;
  isDragging: boolean;
  focusedAppId: string | null;
  
  // Actions
  setActiveLeftTab: (id: string) => void;
  setActiveTopTab: (id: string) => void;
  setIsRecordingShortcut: (val: boolean) => void;
  setIsDragging: (val: boolean) => void;
  setFocusedAppId: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeLeftTab: '2',
  activeTopTab: '1',
  isRecordingShortcut: false,
  isDragging: false,
  focusedAppId: null,

  setFocusedAppId: (id) => set({ focusedAppId: id }),

  setActiveLeftTab: (id) => {
    const state = get();
    const dataStore = useDataStore.getState();

    // 经 DataStore 公开 action 访问顶部标签，不直读/回写 settings.topTabs 内部结构（FR-009）
    const oldTabs = dataStore.getTopTabsFor(state.activeLeftTab);
    const targetIndex = oldTabs.findIndex((t) => t.id === state.activeTopTab);
    const resolvedIndex = targetIndex >= 0 ? targetIndex : 0;

    const newTabs = dataStore.ensureTopTabsFor(id);

    const finalIndex = Math.min(resolvedIndex, newTabs.length - 1);
    set({
      activeLeftTab: id,
      activeTopTab: newTabs[finalIndex]?.id || ''
    });
  },
  
  setActiveTopTab: (id) => set({ activeTopTab: id }),
  setIsRecordingShortcut: (val) => set({ isRecordingShortcut: val }),
  setIsDragging: (val) => set({ isDragging: val }),
}));
