# IPC Contracts

This document outlines the modifications to the Tauri IPC commands interface to support non-blocking execution and precise error handling.

## Tauri Commands (Backend)

The signatures of the Tauri commands remain largely the same for the frontend, but their internal execution and error return types are updated.

### `save_settings` & `save_apps`
- **Frontend Signature**: `async saveSettings(portable: boolean, settingsJson: string): Promise<void>`
- **Backend Signature**: `pub async fn save_settings(...) -> Result<(), AppError>`
- **Contract Change**: Previously, the backend might have spawned a blocking thread and returned `Ok(())` immediately. Now, the command is `async`, and it awaits the background file I/O task. It returns an `AppError` mapping to a specific code (e.g., `IO_ERROR`) if the disk write fails.

### `launch_app`
- **Frontend Signature**: `async launchApp(executablePath: string, args?: string[], runAsAdmin?: boolean, cwd?: string, envs?: Record<string, string>): Promise<void>`
- **Backend Signature**: `pub async fn launch_app(...) -> Result<(), AppError>`
- **Contract Change**: Removes internal synchronous blocking. Errors like `193` (bad executable) or `SECURITY_VIOLATION` (UAC denied) are accurately propagated to the frontend.

## Error Response Format
The frontend expects errors to be serialized as JSON objects:
```typescript
interface AppErrorResponse {
  code: string; // e.g., "IO_ERROR", "SECURITY_VIOLATION", "PROXY_ERROR"
  message: string;
}
```
The frontend UI code will parse this `code` to determine if a Toast Notification should be shown (e.g., on `IO_ERROR` during save).