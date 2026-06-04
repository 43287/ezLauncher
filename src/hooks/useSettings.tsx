import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { load, Store } from '@tauri-apps/plugin-store';

interface SettingsContextType {
  store: Store | null;
  settings: Record<string, any>;
  updateSetting: (key: string, value: any) => Promise<void>;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  store: null,
  settings: {},
  updateSetting: async () => {},
  isLoaded: false,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let currentStore: Store | null = null;

    async function initStore() {
      try {
        currentStore = await load('settings.json', { autoSave: true });
        setStore(currentStore);

        const keys = await currentStore.keys();
        const initialSettings: Record<string, any> = {};
        for (const key of keys) {
          initialSettings[key] = await currentStore.get(key);
        }
        setSettings(initialSettings);
        setIsLoaded(true);
      } catch (err) {
        console.error('Failed to load settings store', err);
      }
    }

    initStore();

    return () => {
      // Cleanup if necessary
    };
  }, []);

  const updateSetting = async (key: string, value: any) => {
    if (store) {
      await store.set(key, value);
      await store.save(); // autoSave is true, but manual save ensures it's written immediately
      setSettings((prev) => ({ ...prev, [key]: value }));
    }
  };

  return (
    <SettingsContext.Provider value={{ store, settings, updateSetting, isLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
