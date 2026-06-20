---
description: "Task list for fixing 6 core defects in ezLaunch"
---

# Tasks: Fix Core Defects

**Input**: Design documents from `/specs/006-fix-core-defects/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tauri-ipc.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Tests are not explicitly generated unless required by the context, but validation steps from quickstart are considered.

## Phase 1: Setup

**Purpose**: Project initialization and basic structure (None required for this refactoring, skipping directly to foundational/stories).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T001 Update `AppError` `From` implementations to map specific `ServiceError` variants properly in `src-tauri/src/application/error.rs`
- [ ] T002 Update `AppError` serialization logic to ensure accurate `code` extraction in `src-tauri/src/application/error.rs`

**Checkpoint**: Error propagation foundation ready.

---

## Phase 3: User Story 1 - Graceful Shutdown of Proxy Listener (Priority: P1)

**Goal**: Prevent zombie threads and ensure clean process termination.

**Independent Test**: Can be fully tested by starting the application and then closing it, observing via Task Manager that no lingering threads or proxy processes remain.

### Implementation for User Story 1

- [ ] T003 [US1] Introduce `std::sync::atomic::AtomicBool` for shutdown signaling in `src-tauri/src/services/proxy_server.rs`
- [ ] T004 [US1] Modify `init_main_listener` loop to periodically check the atomic flag or use a timeout/non-blocking accept in `src-tauri/src/services/proxy_server.rs`
- [ ] T005 [US1] Hook into Tauri's window/app exit events to trigger the shutdown flag in `src-tauri/src/main.rs` or `src-tauri/src/application/events.rs`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - Non-blocking Tauri Commands (Priority: P1)

**Goal**: Improve overall application responsiveness and prevent Tauri event loop starvation.

**Independent Test**: Can be fully tested by executing multiple commands rapidly and ensuring the UI does not freeze.

### Implementation for User Story 2

- [ ] T006 [P] [US2] Refactor `get_system_apps` in `src-tauri/src/application/commands/app_cmds.rs` to properly await `spawn_blocking`
- [ ] T007 [P] [US2] Refactor `launch_app` in `src-tauri/src/application/commands/app_cmds.rs` to properly await `spawn_blocking` (or remove if unnecessary)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase 5: User Story 3 - Reliable Asynchronous I/O (Priority: P1)

**Goal**: Prevent critical data loss and ensure data integrity with frontend notification.

**Independent Test**: Simulate a disk write failure and observe if the application handles it properly and surfaces a Toast Notification to the UI.

### Implementation for User Story 3

- [ ] T008 [P] [US3] Refactor `save_file` in `src-tauri/src/services/store_service.rs` to await the background thread and return `Result<(), ServiceError>` instead of spawning detached
- [ ] T009 [P] [US3] Update `save_settings` and `save_apps` Tauri commands in `src-tauri/src/application/commands/store_cmds.rs` to be async and return the awaited Result
- [ ] T010 [US3] Add global error catching or specific catch blocks in frontend API calls (`src/api/tauri.ts` or component) to trigger a Toast Notification on `IO_ERROR`

**Checkpoint**: All user stories up to 3 should now be independently functional.

---

## Phase 6: User Story 4 - Reliable .lnk Admin Launch (Priority: P1)

**Goal**: Fixes a broken core feature (100% reproducible crash) when launching `.lnk` as admin.

**Independent Test**: Right-click a `.lnk` item, select "Run as administrator", and verify the target application launches successfully.

### Implementation for User Story 4

- [ ] T011 [US4] Implement a helper function using Windows COM API (`IShellLinkW`, `IPersistFile`) to resolve `.lnk` target paths and arguments in `src-tauri/src/services/os/windows.rs`
- [ ] T012 [US4] Update `launch_app` in `src-tauri/src/services/execution_service.rs` to detect `.lnk` files and call the resolution helper before passing to proxy
- [ ] T013 [US4] Ensure resolved arguments and working directories are properly merged with user-provided args in `execution_service.rs`

**Checkpoint**: Admin `.lnk` launch should now be reliable.

---

## Phase 7: User Story 5 - Memory Safety in Crypto Service (Priority: P1)

**Goal**: Prevent potential segmentation faults and memory corruption.

**Independent Test**: Verify encryption/decryption still works correctly.

### Implementation for User Story 5

- [ ] T014 [P] [US5] Refactor `encrypt_data` in `src-tauri/src/services/crypto_service.rs` to copy `data` into a `Vec<u8>` and use `as_mut_ptr()` for `CRYPT_INTEGER_BLOB`
- [ ] T015 [P] [US5] Refactor `decrypt_data` in `src-tauri/src/services/crypto_service.rs` to copy `data` into a `Vec<u8>` and use `as_mut_ptr()` for `CRYPT_INTEGER_BLOB`

**Checkpoint**: All UB should be eliminated from the crypto service.

---

## Phase 8: User Story 6 - Refined Error Handling (Priority: P3)

**Goal**: Specific error types are preserved across the Tauri IPC boundary.

**Independent Test**: Trigger backend errors and verify the frontend receives distinct error codes.

### Implementation for User Story 6

- [ ] T016 [US6] Remove `.map_err(|e| AppError::Other(e.to_string()))` usages across `app_cmds.rs`, `store_cmds.rs`, and `hotkey_cmds.rs`
- [ ] T017 [US6] Replace with `.map_err(AppError::Service)` or direct propagation using `?` where applicable

**Checkpoint**: All user stories are now implemented.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T018 Run quickstart.md validation steps for all features.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A
- **Foundational (Phase 2)**: Must complete first to ensure proper error types are available for US3 and US6.
- **User Stories (Phase 3-8)**: Can proceed in parallel after Foundational.
- **Polish (Final Phase)**: Depends on all user stories.

### Parallel Opportunities

- US1, US2, US3, US4, and US5 can be worked on in parallel as they touch completely different service files (`proxy_server.rs`, `app_cmds.rs`, `store_service.rs`, `execution_service.rs`, `crypto_service.rs`).
- Within US5, `encrypt_data` and `decrypt_data` refactoring can be done in parallel.
- Within US3, backend `store_service.rs` and `store_cmds.rs` refactoring can be done in parallel with frontend Toast implementation.

---

## Implementation Strategy

### Incremental Delivery

1. Complete Foundational Error mapping.
2. Deliver US5 (UB Fix) immediately for safety.
3. Deliver US4 (.lnk fix) to unblock core functionality.
4. Deliver US3 (Async I/O) to ensure data safety.
5. Deliver US1 & US2 for performance and lifecycle stability.
6. Clean up with US6.