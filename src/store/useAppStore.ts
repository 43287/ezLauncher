import { create } from 'zustand';
import { LaunchItem } from '../types';

export type Tab = {
  id: string;
  name: string;
};

interface AppState {
  apps: LaunchItem[];
  leftTabs: Tab[];
  topTabs: Tab[];
  activeLeftTab: string;
  activeTopTab: string;
  
  // Actions
  setApps: (apps: LaunchItem[] | ((prev: LaunchItem[]) => LaunchItem[])) => void;
  setLeftTabs: (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => void;
  setTopTabs: (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => void;
  setActiveLeftTab: (id: string) => void;
  setActiveTopTab: (id: string) => void;
  
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
  topTabs: [
    { id: '1', name: 'Tab 1' },
    { id: '2', name: 'Tab 2' },
    { id: '3', name: 'Tab 3' },
    { id: '4', name: 'Tab 4' }
  ],
  activeLeftTab: '2',
  activeTopTab: '1',

  setApps: (apps) => set((state) => ({ apps: typeof apps === 'function' ? apps(state.apps) : apps })),
  setLeftTabs: (tabs) => set((state) => ({ leftTabs: typeof tabs === 'function' ? tabs(state.leftTabs) : tabs })),
  setTopTabs: (tabs) => set((state) => ({ topTabs: typeof tabs === 'function' ? tabs(state.topTabs) : tabs })),
  setActiveLeftTab: (id) => set({ activeLeftTab: id }),
  setActiveTopTab: (id) => set({ activeTopTab: id }),

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