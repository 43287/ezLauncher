import { create } from 'zustand';
import { LaunchItem } from '../types';

export type Tab = {
  id: string;
  name: string;
};

interface AppState {
  apps: LaunchItem[];
  leftTabs: Tab[];
  topTabs: Record<string, Tab[]>;
  activeLeftTab: string;
  activeTopTab: string;
  isRecordingShortcut: boolean;
  
  // Actions
  setApps: (apps: LaunchItem[] | ((prev: LaunchItem[]) => LaunchItem[])) => void;
  setLeftTabs: (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => void;
  setTopTabs: (tabs: Record<string, Tab[]> | ((prev: Record<string, Tab[]>) => Record<string, Tab[]>)) => void;
  setActiveLeftTab: (id: string) => void;
  setActiveTopTab: (id: string) => void;
  setIsRecordingShortcut: (val: boolean) => void;
  
  addApp: (newApp: LaunchItem) => void;
  removeApp: (id: string) => void;
  updateApp: (id: string, updates: Partial<LaunchItem>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  apps: [],
  leftTabs: [
    { id: '2', name: 'Work' },
    { id: '3', name: 'Game' }
  ],
  topTabs: {
    '2': [{ id: '1', name: 'Tab 1' }],
    '3': [{ id: '2', name: 'Tab 2' }]
  },
  activeLeftTab: '2',
  activeTopTab: '1',
  isRecordingShortcut: false,

  setApps: (apps) => set((state) => ({ apps: typeof apps === 'function' ? apps(state.apps) : apps })),
  setLeftTabs: (tabs) => set((state) => ({ leftTabs: typeof tabs === 'function' ? tabs(state.leftTabs) : tabs })),
  setTopTabs: (tabs) => set((state) => ({ topTabs: typeof tabs === 'function' ? tabs(state.topTabs) : tabs })),
  setActiveLeftTab: (id) => set((state) => {
    const oldTabs = state.topTabs[state.activeLeftTab] || [];
    const targetIndex = oldTabs.findIndex(t => t.id === state.activeTopTab);
    const resolvedIndex = targetIndex >= 0 ? targetIndex : 0;

    let newTabs = state.topTabs[id] || [];
    let newState: Partial<AppState> = { activeLeftTab: id };

    if (newTabs.length === 0) {
      newTabs = [
        { id: Date.now().toString() + "-1", name: 'Tab 1' },
        { id: Date.now().toString() + "-2", name: 'Tab 2' },
        { id: Date.now().toString() + "-3", name: 'Tab 3' },
        { id: Date.now().toString() + "-4", name: 'Tab 4' }
      ];
      newState.topTabs = { ...state.topTabs, [id]: newTabs };
    }

    const finalIndex = Math.min(resolvedIndex, newTabs.length - 1);
    newState.activeTopTab = newTabs[finalIndex]?.id || '';

    return newState;
  }),
  setActiveTopTab: (id) => set({ activeTopTab: id }),
  setIsRecordingShortcut: (val) => set({ isRecordingShortcut: val }),

  addApp: (newApp) => set((state) => {
    const appWithIds = {
      ...newApp,
      categoryId: newApp.categoryId || state.activeLeftTab,
      columnId: newApp.columnId || state.activeTopTab
    };
    return { apps: [...state.apps, appWithIds] };
  }),

  removeApp: (id) => set((state) => ({ apps: state.apps.filter(app => app.id !== id) })),
  updateApp: (id, updates) => set((state) => ({
    apps: state.apps.map(app => app.id === id ? { ...app, ...updates } : app)
  })),
}));