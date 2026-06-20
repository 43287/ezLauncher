export interface LaunchContext {
    targetPath: string; // The executable or link path
    argsArray: string[]; // Parsed arguments
    cwd?: string; // Working directory
    envs?: Record<string, string>; // Environment variables
    runAsAdmin: boolean;
    inTerminal: boolean;
}
