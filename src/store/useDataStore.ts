import { create } from 'zustand';
import { LaunchItem, SettingsConfig, SettingsSchema, Tab } from '../types';
import { platform } from '../api/platform';
import { useToastStore } from './useToastStore';
import { PERSIST_DEBOUNCE_MS } from '../constants/storage';
import { generateId } from '../constants/ids';

// 便携标志缓存：由启动流程从注册表读取后写入，持久化订阅同步读取此值（取代 localStorage）
let cachedPortable = true;
export const setCachedPortable = (portable: boolean) => {
  cachedPortable = portable;
};

interface DataState {
  apps: LaunchItem[];
  settings: SettingsConfig;
  isLoaded: boolean;
  
  // Actions
  setApps: (apps: LaunchItem[] | ((prev: LaunchItem[]) => LaunchItem[])) => void;
  updateSetting: <K extends keyof SettingsConfig>(key: K, value: SettingsConfig[K]) => void;
  setSettings: (settings: SettingsConfig) => void;
  setIsLoaded: (loaded: boolean) => void;
  
  addApp: (newApp: LaunchItem) => void;
  removeApp: (id: string) => void;
  updateApp: (id: string, updates: Partial<LaunchItem>) => void;

  // 顶部标签读取/按需初始化（供 UIStore 调用，避免其直读 settings.topTabs 内部结构）
  getTopTabsFor: (categoryId: string) => Tab[];
  ensureTopTabsFor: (categoryId: string) => Tab[];
}

export const useDataStore = create<DataState>((set, get) => ({
  apps: [],
  settings: SettingsSchema.parse({}) as SettingsConfig, // default settings
  isLoaded: false,

  setIsLoaded: (loaded) => set({ isLoaded: loaded }),

  setSettings: (settings) => set({ settings }),

  setApps: (appsOrUpdater) => {
    set((state) => {
      const newApps = typeof appsOrUpdater === 'function' ? appsOrUpdater(state.apps) : appsOrUpdater;
      return { apps: newApps };
    });
  },

  updateSetting: (key, value) => {
    set((state) => {
      const newSettings = { ...state.settings, [key]: value };
      return { settings: newSettings };
    });
  },

  addApp: (newApp) => {
    set((state) => {
      const newApps = [...state.apps, newApp];
      return { apps: newApps };
    });
  },

  removeApp: (id) => {
    set((state) => {
      const newApps = state.apps.filter(app => app.id !== id);
      return { apps: newApps };
    });
  },

  updateApp: (id, updates) => {
    set((state) => {
      const newApps = state.apps.map(app => app.id === id ? { ...app, ...updates } : app);
      return { apps: newApps };
    });
  },

  getTopTabsFor: (categoryId) => {
    const topTabs = get().settings.topTabs || {};
    return topTabs[categoryId] || [];
  },

  ensureTopTabsFor: (categoryId) => {
    const state = get();
    const topTabs = state.settings.topTabs || {};
    const existing = topTabs[categoryId];
    if (existing && existing.length > 0) {
      return existing;
    }
    const newTabs: Tab[] = [
      { id: generateId(), name: 'Tab 1', iconUrl: null },
      { id: generateId(), name: 'Tab 2', iconUrl: null },
      { id: generateId(), name: 'Tab 3', iconUrl: null },
      { id: generateId(), name: 'Tab 4', iconUrl: null },
    ];
    set({ settings: { ...state.settings, topTabs: { ...topTabs, [categoryId]: newTabs } } });
    return newTabs;
  },
}));

// Setup persistence subscriptions
let appsSaveTimeout: ReturnType<typeof setTimeout> | null = null;
let settingsSaveTimeout: ReturnType<typeof setTimeout> | null = null;

useDataStore.subscribe((state, prevState) => {
  if (!state.isLoaded) return;

  // Apps changed
  if (state.apps !== prevState.apps) {
    if (appsSaveTimeout) clearTimeout(appsSaveTimeout);
    appsSaveTimeout = setTimeout(async () => {
      try {
        await platform.saveApps(cachedPortable, JSON.stringify(state.apps));
      } catch (err) {
        console.error('Failed to save apps:', err);
        useToastStore.getState().addToast(`保存应用列表失败 (IO_ERROR): ${err}`, 'error');
      }
    }, PERSIST_DEBOUNCE_MS);
  }

  // Settings changed
  if (state.settings !== prevState.settings) {
    if (settingsSaveTimeout) clearTimeout(settingsSaveTimeout);
    settingsSaveTimeout = setTimeout(async () => {
      try {
        await platform.saveSettings(cachedPortable, JSON.stringify(state.settings));
      } catch (err) {
        console.error('Failed to save settings:', err);
        useToastStore.getState().addToast(`保存设置失败 (IO_ERROR): ${err}`, 'error');
      }
    }, PERSIST_DEBOUNCE_MS);
  }
});
