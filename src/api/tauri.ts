import { invoke } from "@tauri-apps/api/core";

export const tauriApi = {
  loadSettings: async (portable: boolean): Promise<string> => {
    return invoke<string>("load_settings", { portable });
  },

  saveSettings: async (
    portable: boolean,
    settingsJson: string,
  ): Promise<void> => {
    return invoke<void>("save_settings", { portable, settingsJson });
  },

  launchApp: async (
    executablePath: string,
    args: string[],
    runAsAdmin: boolean,
    cwd?: string,
    envs?: Record<string, string>,
  ): Promise<void> => {
    return invoke<void>("launch_app", { executablePath, args, runAsAdmin, cwd, envs });
  },

  hideWindow: async (): Promise<void> => {
    return invoke<void>("hide_window");
  },

  extractFileInfo: async (
    filePath: string,
  ): Promise<{ name?: string; iconUrl?: string }> => {
    return invoke<{ name?: string; iconUrl?: string }>("extract_file_info", {
      filePath,
    });
  },

  restartAsAdmin: async (): Promise<void> => {
    return invoke<void>("restart_as_admin");
  },

  getSystemApps: async (): Promise<
    { name: string; path: string; iconUrl: string }[]
  > => {
    return invoke<{ name: string; path: string; iconUrl: string }[]>(
      "get_system_apps",
    );
  },

  registerShortcut: async (shortcut: string): Promise<void> => {
    return invoke<void>("register_shortcut", { shortcut });
  },

  unregisterAllShortcuts: async (): Promise<void> => {
    return invoke<void>("unregister_all_shortcuts");
  },
};
