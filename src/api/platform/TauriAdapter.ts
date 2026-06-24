import { invoke } from "@tauri-apps/api/core";
import { IPlatform } from "./IPlatform";
import type { ProcessInfo, ResolveResult } from "../../types";

// 基础设施适配层：仅与后端通信、失败时抛出，不依赖任何 UI（如 Toast）。
// 用户提示由调用方（如 useDataStore 持久化协调）决定（FR-008）。
export class TauriAdapter implements IPlatform {
    async loadSettings(portable: boolean): Promise<string> {
        return invoke<string>("load_settings", { portable });
    }

    async saveSettings(portable: boolean, settingsJson: string): Promise<void> {
        return invoke<void>("save_settings", { portable, settingsJson });
    }

    async loadApps(portable: boolean): Promise<string> {
        return invoke<string>("load_apps", { portable });
    }

    async saveApps(portable: boolean, appsJson: string): Promise<void> {
        return invoke<void>("save_apps", { portable, appsJson });
    }

    async restoreFromBackup(portable: boolean): Promise<void> {
        return invoke<void>("restore_from_backup", { portable });
    }

    async loadHistory(portable: boolean): Promise<string> {
        return invoke<string>("load_history", { portable });
    }

    async saveHistory(portable: boolean, historyJson: string): Promise<void> {
        return invoke<void>("save_history", { portable, historyJson });
    }

    async clearHistory(portable: boolean): Promise<void> {
        return invoke<void>("clear_history", { portable });
    }

    async getPortableMode(): Promise<boolean> {
        return invoke<boolean>("get_portable_mode");
    }

    async setPortableMode(enabled: boolean): Promise<void> {
        return invoke<void>("set_portable_mode", { enabled });
    }

    async ensurePortableRecord(): Promise<void> {
        return invoke<void>("ensure_portable_record");
    }

    async getStoreInitInfo(
        portable: boolean,
    ): Promise<{ settingsExists: boolean; appsExists: boolean; hasRecord: boolean }> {
        return invoke<{ settingsExists: boolean; appsExists: boolean; hasRecord: boolean }>(
            "get_store_init_info",
            { portable },
        );
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
        creationFlag?: number,
    ): Promise<void> {
        return invoke<void>("launch_app", { executablePath, args, runAsAdmin, cwd, envs, creationFlag });
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

    async enumerateProcesses(): Promise<ProcessInfo[]> {
        return invoke<ProcessInfo[]>("enumerate_processes");
    }

    async resolveWindowProcessAtCursor(): Promise<ResolveResult> {
        return invoke<ResolveResult>("resolve_window_process_at_cursor");
    }
}
