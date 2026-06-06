import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { tauriApi } from '../api/tauri';
import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';
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
        let initialSettings: Record<string, SettingValue> = {};
        try {
            initialSettings = JSON.parse(settingsJsonStr);
            if (initialSettings && typeof initialSettings === 'object' && Array.isArray(initialSettings.apps)) {
                (initialSettings.apps as any[]).forEach((app: any) => {
                    if (typeof app.iconUrl === 'string' && app.iconUrl.includes('data:image/png;base64')) {
                        // 如果有 executablePath，自动转换为新的自定义协议获取图标
                        if (app.executablePath) {
                            const encodedPath = encodeURIComponent(app.executablePath).replace(/['()]/g, escape).replace(/\*/g, '%2A');
                            app.iconUrl = `http://ezicon.localhost/${encodedPath}`;
                        } else {
                            app.iconUrl = undefined;
                        }
                    }
                });
            }
        } catch (e) {
            console.error('Failed to parse settings JSON', e);
        }

        // 同步自启状态与系统实际状态
        try {
          const autostartEnabled = await isEnabled();
          if (initialSettings.autoStart !== undefined && initialSettings.autoStart !== autostartEnabled) {
            if (initialSettings.autoStart) {
              await enable();
            } else {
              await disable();
            }
          } else if (initialSettings.autoStart === undefined) {
            initialSettings.autoStart = autostartEnabled;
          }
        } catch (e) {
          console.error("Failed to sync autostart status:", e);
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

  useEffect(() => {
    if (!isLoaded) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      const serializeAndSave = () => {
        try {
          const jsonStr = JSON.stringify(settings);
          tauriApi.saveSettings(isPortable, jsonStr).catch(err => {
            console.error('Failed to save settings:', err);
          });
        } catch (err) {
          console.error('Failed to stringify settings:', err);
        }
      };

      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(serializeAndSave);
      } else {
        Promise.resolve().then(serializeAndSave);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [settings, isPortable, isLoaded]);

  const updateSetting = useCallback(async (key: string, value: SettingValue) => {
    // 处理系统级特效，如开机自启
    if (key === 'autoStart') {
      const toggleAutostart = async () => {
        try {
          if (value) {
            await enable();
          } else {
            await disable();
          }
        } catch (e) {
          console.error("Failed to toggle autostart:", e);
        }
      };
      toggleAutostart();
    }

    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

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
