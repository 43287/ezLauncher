# Frontend Internal Contracts

This refactoring introduces internal contracts to decouple UI from implementation details.

## 1. `IPlatform` Interface
Defines the contract that any platform adapter (Tauri, Web Mock, Electron) must fulfill.

```typescript
// src/api/platform/IPlatform.ts
export interface IPlatform {
  launchApp(
    executablePath: string, 
    args?: string[], 
    runAsAdmin?: boolean, 
    cwd?: string, 
    envs?: Record<string, string>
  ): Promise<void>;
  
  hideWindow(): Promise<void>;
  
  // Other existing API methods...
}
```

## 2. `LaunchService` Contract
Defines how the UI requests a launch operation.

```typescript
// src/services/LaunchService.ts
export class LaunchService {
  /**
   * Evaluates the launch item and its context, then requests the platform adapter to execute it.
   */
  public static async executeLaunch(
    app: LaunchItem, 
    platform: IPlatform,
    forceAdmin: boolean = false,
    dropPaths?: string[]
  ): Promise<void> {
    // ... handles hideWindow, URL routing, shell routing, and macro replacement ...
  }
}
```