import { create } from 'zustand';
import { LaunchItem, SettingsConfig, SettingsSchema } from '../types';
import { tauriApi } from '../api/tauri';

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
}

export const useDataStore = create<DataState>((set) => ({
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
        const isPortable = localStorage.getItem('portable_mode') !== 'false';
        await tauriApi.saveApps(isPortable, JSON.stringify(state.apps));
      } catch (err) {
        console.error('Failed to save apps:', err);
      }
    }, 500);
  }

  // Settings changed
  if (state.settings !== prevState.settings) {
    if (settingsSaveTimeout) clearTimeout(settingsSaveTimeout);
    settingsSaveTimeout = setTimeout(async () => {
      try {
        const isPortable = localStorage.getItem('portable_mode') !== 'false';
        await tauriApi.saveSettings(isPortable, JSON.stringify(state.settings));
      } catch (err) {
        console.error('Failed to save settings:', err);
      }
    }, 500);
  }
});
