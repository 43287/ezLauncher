# Data Model

No new persistent data entities are introduced. However, the internal data flow between the UI, Service, and Adapter layers is formalized.

## 1. Launch Context Model
The `LaunchService` will take a `LaunchItem` and return a standardized `LaunchContext` object, decoupling the parsing from the execution.

```typescript
export interface LaunchContext {
  targetPath: string; // The executable or link path
  argsArray: string[]; // Parsed arguments
  cwd?: string; // Working directory
  envs?: Record<string, string>; // Environment variables
  runAsAdmin: boolean;
  inTerminal: boolean;
}
```

## 2. Platform Adapter Interface (`IPlatform`)
Defines the contract for the underlying OS/Environment interactions.

```typescript
export interface IPlatform {
  launchApp(
    executablePath: string, 
    args?: string[], 
    runAsAdmin?: boolean, 
    cwd?: string, 
    envs?: Record<string, string>
  ): Promise<void>;
  
  hideWindow(): Promise<void>;
  
  // Other methods migrated from tauriApi...
}
```