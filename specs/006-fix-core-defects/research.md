# Research & Technical Decisions

## 1. Graceful Shutdown of Proxy Listener
**Decision**: Use `std::sync::atomic::AtomicBool` combined with a timeout/polling mechanism in the listener loop, or an `mpsc::channel` for signaling shutdown. Since the `LocalSocketStream` listener is blocking, an atomic flag checked periodically or a non-blocking accept with a timeout is best.
**Rationale**: Prevents zombie threads on application exit without requiring complex async runtimes in the proxy.
**Alternatives considered**: Killing the thread forcefully (unsafe), using a dummy connection to unblock `accept` (viable but slightly hacky, though sometimes necessary for blocking IPC pipes).

## 2. Resolving `.lnk` Targets
**Decision**: Use Windows COM API (`IShellLinkW` and `IPersistFile`).
**Rationale**: This is the official, most robust way to resolve Windows shortcuts. It correctly handles environment variables, working directories, and arguments embedded in the `.lnk` file.
**Alternatives considered**: Manual binary parsing of the `.lnk` format (brittle and error-prone), executing `cmd.exe /c start` directly (doesn't give us the actual path for the proxy to use with elevated privileges).

## 3. Undefined Behavior in `crypto_service.rs`
**Decision**: Allocate a mutable `Vec<u8>` from the immutable slice `&[u8]`, and pass `vec.as_mut_ptr()` to `CryptProtectData` and `CryptUnprotectData`.
**Rationale**: Rust's aliasing rules forbid casting `*const T` to `*mut T` if the underlying data wasn't originally mutable. `CryptProtectData` technically requires a mutable pointer for `pbData` in its `DATA_BLOB` struct, even if it doesn't mutate the input. Copying to a `Vec` ensures memory safety and satisfies the FFI requirements.
**Alternatives considered**: None. UB must be eliminated entirely.

## 4. Tauri Commands & `spawn_blocking`
**Decision**: Remove `spawn_blocking` for fast operations or properly `await` asynchronous operations. If a service method is truly blocking (like synchronous I/O), wrap it in `spawn_blocking` but ensure the Tauri command itself is `async` and awaits the block properly.
**Rationale**: Prevents Tokio thread pool starvation and ensures UI responsiveness.
**Alternatives considered**: Converting all services to `async` (too large of a refactor for this specific defect fix).

## 5. Async I/O Silent Failures
**Decision**: Refactor `save_file` in `store_service.rs` to await the completion of the file write operations, and return the `Result` to the frontend. The frontend will catch the error and display a Toast Notification.
**Rationale**: Ensures data integrity and provides immediate feedback to the user.
**Alternatives considered**: Polling for file changes (inefficient).

## 6. Preserving IPC Errors
**Decision**: Update `AppError` `From` implementations to map specific `ServiceError` variants properly, avoiding the catch-all `AppError::Other`.
**Rationale**: Allows the frontend to distinguish between `IoError`, `SecurityViolation`, etc., and show appropriate localized messages.
**Alternatives considered**: String parsing of generic error messages (fragile).
