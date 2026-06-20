# Data Model

No new persistent data entities are introduced in this refactoring. However, internal data structures and IPC contracts are modified to support proper error handling and target resolution.

## 1. Error Model (`AppError` & `ServiceError`)
The backend error enum serialization is updated to ensure all variants are correctly mapped to frontend recognizable codes.

```rust
// Internal structure mapping concept
pub enum AppError {
    Io(std::io::Error),
    Crypto(String),
    Tauri(tauri::Error),
    Execution(String),
    Service(ServiceError), // Crucial: Service errors are preserved
    Other(String),
}

// Serializes to:
// { "code": "IO_ERROR" | "SECURITY_VIOLATION" | "PROXY_ERROR" ..., "message": "..." }
```

## 2. `.lnk` Resolution Context
When resolving a `.lnk` file, the backend extracts the following data model before passing it to the proxy:
- `target_path`: String (The actual executable path)
- `arguments`: String (Arguments embedded in the shortcut)
- `working_directory`: String (The starting directory for the shortcut)
