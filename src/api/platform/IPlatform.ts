export interface IPlatform {
    loadSettings(portable: boolean): Promise<string>;
    saveSettings(portable: boolean, settingsJson: string): Promise<void>;
    loadApps(portable: boolean): Promise<string>;
    saveApps(portable: boolean, appsJson: string): Promise<void>;
    restoreFromBackup(portable: boolean): Promise<void>;
    loadHistory(portable: boolean): Promise<string>;
    saveHistory(portable: boolean, historyJson: string): Promise<void>;
    clearHistory(portable: boolean): Promise<void>;
    getPortableMode(): Promise<boolean>;
    setPortableMode(enabled: boolean): Promise<void>;
    ensurePortableRecord(): Promise<void>;
    getStoreInitInfo(portable: boolean): Promise<{ settingsExists: boolean; appsExists: boolean; hasRecord: boolean }>;
    updateWindowWidth(width: number, isLeftDock: boolean): Promise<void>;
    launchApp(
        executablePath: string,
        args: string[],
        runAsAdmin: boolean,
        cwd?: string,
        envs?: Record<string, string>,
        creationFlag?: number
    ): Promise<void>;
    hideWindow(): Promise<void>;
    extractFileInfo(filePath: string): Promise<{ name?: string; iconUrl?: string; isDir?: boolean }>;
    restartAsAdmin(): Promise<void>;
    getSystemApps(): Promise<{ name: string; path: string; iconUrl: string }[]>;
    registerShortcut(shortcut: string): Promise<void>;
    unregisterAllShortcuts(): Promise<void>;
    enumerateProcesses(): Promise<import("../../types").ProcessInfo[]>;
    resolveWindowProcessAtCursor(): Promise<import("../../types").ResolveResult>;
}
