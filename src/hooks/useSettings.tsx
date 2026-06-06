import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { tauriApi } from '../api/tauri';
import { SettingValue } from '../types';

interface SettingsContextType {
  settings: Record<string, SettingValue>;
  updateSetting: (key: string, value: SettingValue) => Promise<void>;
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
  const [settings, setSettings] = useState<Record<string, SettingValue>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPortable, setIsPortable] = useState(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const updateSetting = useCallback(async (key: string, value: SettingValue) => {
    setSettings((prev) => {
      const newSettings = { ...prev, [key]: value };
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        tauriApi.saveSettings(isPortable, JSON.stringify(newSettings))
          .catch(err => {
            console.error('Failed to save settings:', err);
          });
      }, 500); // 500ms debounce
      
      return newSettings;
    });
  }, [isPortable]);

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
