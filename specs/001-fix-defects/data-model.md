# Data Model & State Transitions

## 1. Error Payload Model (Rust -> TypeScript)

**Entity:** `AppError` (Rust) / `ApiError` (TS)

```typescript
// Frontend type mapping
interface ApiError {
  code: string;       // e.g., "PROXY_CONNECTION_FAILED", "UNAUTHORIZED", "IO_ERROR"
  message: string;    // Human readable context
  details?: unknown;  // Optional debugging info
}
```

*Transitions/Usage*: Returned via `Result<T, AppError>` in Tauri commands. The frontend intercepts this to show specific Toast or localized errors.

## 2. Zustand State Models

**Entity:** `useDataStore` (Persisted)
```typescript
interface DataStore {
  apps: AppEntity[];
  leftTabs: TabEntity[];
  topTabs: TabEntity[];
  addApp: (app: AppEntity) => void;
  updateApp: (id: string, updates: Partial<AppEntity>) => void;
  // ...
}
```

**Entity:** `useUIStore` (Transient)
```typescript
interface UIStore {
  activeLeftTab: string;
  activeTopTab: string;
  isDragging: boolean;
  setActiveLeftTab: (id: string) => void;
  // ...
}
```

*Transitions/Usage*: Separation guarantees that `setActiveLeftTab` will NOT trigger the `useStoreSync` persistence hook.

## 3. Proxy Command Context (Rust)

**Entity:** `ProxyCommand`
```rust
pub struct ProxyCommand {
    pub path: String,
    pub args: Option<Vec<String>>, // Now properly parsed via shell-words
    pub cwd: Option<String>,
    pub envs: Option<HashMap<String, String>>,
    pub action: Option<String>,
}
```
