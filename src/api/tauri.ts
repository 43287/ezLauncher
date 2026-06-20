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

  loadApps: async (portable: boolean): Promise<string> => {
    return invoke<string>("load_apps", { portable });
  },

  saveApps: async (
    portable: boolean,
    appsJson: string,
  ): Promise<void> => {
    return invoke<void>("save_apps", { portable, appsJson });
  },

  restoreFromBackup: async (portable: boolean): Promise<void> => {
    return invoke<void>("restore_from_backup", { portable });
  },

  updateWindowWidth: async (width: number, isLeftDock: boolean): Promise<void> => {
    return invoke<void>("update_window_width", { width, isLeftDock });
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
  ): Promise<{ name?: string; iconUrl?: string; isDir?: boolean }> => {
    return invoke<{ name?: string; iconUrl?: string; isDir?: boolean }>("extract_file_info", {
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
