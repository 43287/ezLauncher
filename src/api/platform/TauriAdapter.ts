import { invoke } from "@tauri-apps/api/core";
import { useToastStore } from "../../store/useToastStore";
import { IPlatform } from "./IPlatform";

export class TauriAdapter implements IPlatform {
    async loadSettings(portable: boolean): Promise<string> {
        return invoke<string>("load_settings", { portable });
    }

    async saveSettings(portable: boolean, settingsJson: string): Promise<void> {
        try {
            await invoke<void>("save_settings", { portable, settingsJson });
        } catch (err: any) {
            console.error("Failed to save settings:", err);
            useToastStore.getState().addToast(`保存设置失败 (IO_ERROR): ${err}`, 'error');
            throw err;
        }
    }

    async loadApps(portable: boolean): Promise<string> {
        return invoke<string>("load_apps", { portable });
    }

    async saveApps(portable: boolean, appsJson: string): Promise<void> {
        try {
            await invoke<void>("save_apps", { portable, appsJson });
        } catch (err: any) {
            console.error("Failed to save apps:", err);
            useToastStore.getState().addToast(`保存应用列表失败 (IO_ERROR): ${err}`, 'error');
            throw err;
        }
    }

    async restoreFromBackup(portable: boolean): Promise<void> {
        return invoke<void>("restore_from_backup", { portable });
    }

    async updateWindowWidth(width: number, isLeftDock: boolean): Promise<void> {
        return invoke<void>("update_window_width", { width, isLeftDock });
    }

    async launchApp(
        executablePath: string,
        args: string[],
        runAsAdmin: boolean,
        cwd?: string,
        envs?: Record<string, string>,
    ): Promise<void> {
        return invoke<void>("launch_app", { executablePath, args, runAsAdmin, cwd, envs });
    }

    async hideWindow(): Promise<void> {
        return invoke<void>("hide_window");
    }

    async extractFileInfo(
        filePath: string,
    ): Promise<{ name?: string; iconUrl?: string; isDir?: boolean }> {
        return invoke<{ name?: string; iconUrl?: string; isDir?: boolean }>("extract_file_info", {
            filePath,
        });
    }

    async restartAsAdmin(): Promise<void> {
        return invoke<void>("restart_as_admin");
    }

    async getSystemApps(): Promise<{ name: string; path: string; iconUrl: string }[]> {
        return invoke<{ name: string; path: string; iconUrl: string }[]>("get_system_apps");
    }

    async registerShortcut(shortcut: string): Promise<void> {
        return invoke<void>("register_shortcut", { shortcut });
    }

    async unregisterAllShortcuts(): Promise<void> {
        return invoke<void>("unregister_all_shortcuts");
    }
}
