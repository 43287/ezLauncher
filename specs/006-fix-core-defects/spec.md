# Feature Specification: Fix Core Defects

**Feature Branch**: `006-fix-core-defects`

**Created**: 2026-06-21

**Status**: Draft

**Input**: User description: "尝试对后台监听线程脱缰（生命周期失控）、中风险：跨层异步阻塞冗余、高风险：异步 I/O 静默失败（数据丢失隐患）、高风险：快捷方式（.lnk）提权启动必定崩溃、低风险：冗余的错误处理映射与类型降级、高风险：不可变切片强制转可变指针这几个问题进行修复"

## Clarifications

### Session 2026-06-21
- Q: For fixing the .lnk admin launch bug (FR-004), how should the backend resolve the .lnk target path? → A: Windows COM API (Recommended)
- Q: For gracefully shutting down the proxy listener thread (FR-001), what synchronization mechanism should be used to signal the thread to exit? → A: Atomic Flag / CancellationToken (Recommended)
- Q: When fixing the asynchronous I/O silent failures (FR-003), how should the frontend notify the user if a disk write fails? → A: Toast Notification (Recommended)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Graceful Shutdown of Proxy Listener (Priority: P1)

As a system administrator, when I close the main application, the background proxy listener thread should shut down gracefully.

**Why this priority**: Prevents zombie threads and ensures clean process termination.

**Independent Test**: Can be fully tested by starting the application and then closing it, observing via Task Manager that no lingering threads or proxy processes remain.

**Acceptance Scenarios**:

1. **Given** the application is running, **When** the application is closed, **Then** the proxy listener thread terminates cleanly without hanging.

---

### User Story 2 - Non-blocking Tauri Commands (Priority: P1)

As a user, I want the UI to remain responsive even when the backend is performing OS operations or IPC communication.

**Why this priority**: Improves overall application responsiveness and prevents Tauri event loop starvation.

**Independent Test**: Can be fully tested by executing multiple commands rapidly (like launching multiple apps) and ensuring the UI does not freeze.

**Acceptance Scenarios**:

1. **Given** the application is running, **When** multiple system calls or proxy commands are invoked simultaneously, **Then** the UI remains responsive and commands execute asynchronously without blocking the main Tokio thread pool.

---

### User Story 3 - Reliable Asynchronous I/O (Priority: P1)

As a user, I want to be confident that my settings and app data are saved reliably, and if saving fails, I am notified instead of data being silently lost.

**Why this priority**: Prevents critical data loss and ensures data integrity.

**Independent Test**: Can be fully tested by simulating a disk write failure (e.g., setting the config file to read-only) and observing if the application handles it properly and surfaces a Toast Notification to the UI.

**Acceptance Scenarios**:

1. **Given** the user modifies settings, **When** the settings are saved and a disk error occurs, **Then** the save operation returns an error to the frontend and a Toast Notification is shown instead of silently succeeding.

---

### User Story 4 - Reliable .lnk Admin Launch (Priority: P1)

As a user, when I choose to launch a `.lnk` shortcut as an administrator, the application should successfully start the target program.

**Why this priority**: Fixes a broken core feature (100% reproducible crash).

**Independent Test**: Can be fully tested by right-clicking a `.lnk` item and selecting "Run as administrator", and verifying the target application launches successfully with admin rights.

**Acceptance Scenarios**:

1. **Given** a `.lnk` shortcut in the launcher, **When** the user clicks "Run as Administrator", **Then** the system resolves the target path using Windows COM API and successfully launches the executable with elevated privileges.

---

### User Story 5 - Memory Safety in Crypto Service (Priority: P1)

As a system, I must perform DPAPI encryption/decryption without triggering undefined behavior (UB) in Rust.

**Why this priority**: Prevents potential segmentation faults and memory corruption.

**Independent Test**: Can be fully tested by verifying encryption/decryption still works correctly and code passes safety audits.

**Acceptance Scenarios**:

1. **Given** data to be encrypted/decrypted, **When** the crypto service is called, **Then** it processes the data safely without casting immutable slices to mutable pointers.

---

### User Story 6 - Refined Error Handling (Priority: P3)

As a developer, I want specific error types to be preserved across the Tauri IPC boundary so the frontend can handle different errors appropriately.

**Why this priority**: Improves maintainability and allows for better user feedback.

**Independent Test**: Can be fully tested by triggering different backend errors (e.g., IO error vs Security error) and verifying the frontend receives distinct error codes.

**Acceptance Scenarios**:

1. **Given** a backend service error occurs, **When** it is propagated to the frontend, **Then** it retains its specific error type instead of being downgraded to a generic "Other" error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement an Atomic Flag / CancellationToken for the proxy listener thread in `proxy_server.rs` to signal the thread to exit.
- **FR-002**: System MUST refactor Tauri commands in `app_cmds.rs` to avoid using `spawn_blocking` unnecessarily, leveraging async Rust properly.
- **FR-003**: System MUST ensure that `save_file` in `store_service.rs` properly awaits the background task and returns any `Result` to the caller, and the frontend MUST notify the user via a Toast Notification if the disk write fails.
- **FR-004**: System MUST resolve `.lnk` file targets to their actual executable paths using the Windows COM API before passing them to the proxy server for admin launch in `execution_service.rs`.
- **FR-005**: System MUST preserve `ServiceError` types when converting to `AppError` in Tauri commands instead of mapping everything to `AppError::Other`.
- **FR-006**: System MUST copy immutable data to a mutable buffer (`Vec<u8>`) before calling Windows DPAPI FFI functions in `crypto_service.rs`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of `.lnk` shortcuts launch successfully when requested to run as administrator.
- **SC-002**: Application process exits completely within 1 second of closing, with no background threads remaining.
- **SC-003**: Codebase contains 0 instances of casting immutable slices `&[u8]` to mutable pointers `*mut u8`.
- **SC-004**: Simulated I/O errors during save operations are successfully caught and propagated to the frontend layer.
- **SC-005**: Unnecessary `spawn_blocking` calls are removed from Tauri commands.

## Assumptions

- The application will continue to use Windows DPAPI for encryption.
- The `proxy_server.rs` architecture will remain but its lifecycle will be managed properly.
- Resolving `.lnk` targets relies on standard Windows APIs which are assumed to be accessible.