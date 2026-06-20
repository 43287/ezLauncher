# Interface Contract: Tauri Commands

## 1. `launch_app` Command

**Frontend Invocation:**
```typescript
await invoke('launch_app', {
  executablePath: "C:\\Program Files\\App.exe",
  args: ["/arg1", "value with spaces"], // Array of pre-parsed strings OR single raw string to be parsed by shell-words
  cwd: null,
  envs: null,
  isAdmin: true // New explicit boolean, replacing pseudoEvent hack
});
```

**Rust Signature:**
```rust
#[tauri::command]
pub async fn launch_app(
    executable_path: String,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    envs: Option<HashMap<String, String>>,
    is_admin: Option<bool>
) -> Result<(), AppError>
```

## 2. Error Contract (AppError JSON)

**Response on Failure:**
```json
{
  "code": "SECURITY_VIOLATION",
  "message": "Proxy connection rejected: Invalid parent process"
}
```
