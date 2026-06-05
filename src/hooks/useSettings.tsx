import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { tauriApi } from '../api/tauri';

interface SettingsContextType {
  settings: Record<string, any>;
  updateSetting: (key: string, value: any) => Promise<void>;
  isLoaded: boolean;
  isPortable: boolean;
  setPortableMode: (portable: boolean) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: {},
  updateSetting: async () => {},
  isLoaded: false,
  isPortable: true,
  setPortableMode: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPortable, setIsPortable] = useState(true);

  useEffect(() => {
    async function initStore() {
      try {
        const portableFlag = localStorage.getItem('portable_mode') !== 'false';
        setIsPortable(portableFlag);
        
        const settingsJsonStr = await tauriApi.loadSettings(portableFlag);
        let initialSettings = {};
        try {
            initialSettings = JSON.parse(settingsJsonStr);
        } catch (e) {
            console.error('Failed to parse settings JSON', e);
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
    setSettings((prev) => {
      const newSettings = { ...prev, [key]: value };
      // Save in background
      tauriApi.saveSettings(isPortable, JSON.stringify(newSettings))
        .catch(err => {
          console.error('Failed to save settings:', err);
        });
      return newSettings;
    });
  };

  const setPortableMode = async (portable: boolean) => {
    localStorage.setItem('portable_mode', portable.toString());
    setIsPortable(portable);
    // Setting toggle requires restart, handled by component
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, isLoaded, isPortable, setPortableMode }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
