---
description: "Task list template for feature implementation"
---

# Tasks: fix-defects

**Input**: Design documents from `/specs/001-fix-defects/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/tauri-commands.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `src/`
- **Backend (Rust)**: `src-tauri/src/`

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Core data models and utilities needed across multiple components.

- [x] T001 [P] Extract `AppError` JSON enum mapping in `src-tauri/src/application/error.rs`
- [x] T002 [P] Update Tauri error mapping and tracing in `src-tauri/src/lib.rs` to support structured JSON response
- [x] T003 Update frontend `ApiError` interface type definitions in `src/types/index.ts`
- [x] T004 Add `shell-words` dependency to `src-tauri/Cargo.toml`

**Checkpoint**: Foundation ready - structured error handling and new dependency in place.

---

## Phase 2: User Story 1 - 管理员代理进程安全提权 (Priority: P1) 🎯 MVP

**Goal**: Fix the critical LPE vulnerability and prevent sync I/O blocking in the proxy.

**Independent Test**: Connect to `ezlauncher_main_proxy_*.sock` manually and attempt injection; the proxy must reject it.

### Implementation for User Story 1

- [x] T005 [P] [US1] Remove `return true; // fallback` and `svchost.exe` from `verify_parent_process` in `src-tauri/src/services/proxy_server.rs`
- [x] T006 [US1] Refactor `send_proxy_command` in `src-tauri/src/services/proxy_server.rs` to move `stream.write_all` out of the `PROXY_CONNECTION` Mutex lock (e.g., by cloning the stream or using an async channel).

**Checkpoint**: At this point, User Story 1 should be fully functional. Proxy is secure and non-blocking.

---

## Phase 3: User Story 3 - 准确无误的启动参数解析 (Priority: P1)

**Goal**: Correctly parse Windows command line arguments with spaces and quotes.

**Independent Test**: Launch an app with `/path to/file -arg "quoted string"`, ensuring args aren't mangled.

### Implementation for User Story 3

- [x] T007 [US3] Modify `launch_app_windows` in `src-tauri/src/services/os/windows.rs` to utilize `shell-words` for argument parsing if args are passed as a single string.
- [x] T008 [US3] Refactor frontend `buildLaunchContext` in `src/components/ShortcutItem.tsx` to stop using RegEx for parameter splitting, and pass the raw args string directly to backend.

**Checkpoint**: User Story 1 AND 3 should both work independently. Parameter parsing is accurate.

---

## Phase 4: User Story 2 - 稳定的快捷键与拖拽体验 (Priority: P2)

**Goal**: Decouple the "God Component" `App.tsx` and stop mutating React synthetic events.

**Independent Test**: Reorder icons quickly without duplicate keys warning; use hotkeys without crashing.

### Implementation for User Story 2

- [x] T009 [P] [US2] Create `src/store/useDataStore.ts` and migrate persisted logic (`apps`, `leftTabs`) from `useAppStore.ts`
- [x] T010 [P] [US2] Create `src/store/useUIStore.ts` and migrate transient logic (`activeLeftTab`, `isDragging`) from `useAppStore.ts`
- [x] T011 [US2] Replace `Date.now().toString()` with `crypto.randomUUID()` for tab generation in `useDataStore.ts`
- [x] T012 [P] [US2] Create `src/hooks/useGlobalShortcuts.ts` and extract the hotkey interception logic from `App.tsx`
- [x] T013 [P] [US2] Create `src/hooks/useGlobalDragAndDrop.ts` and extract the `dnd-kit` handlers from `App.tsx`
- [x] T014 [US2] Refactor `src/App.tsx` to use the newly created hooks (`useGlobalShortcuts`, `useGlobalDragAndDrop`, `useDataStore`, `useUIStore`) and delete old inline logic.
- [x] T015 [US2] Refactor `src/components/ShortcutItem.tsx` to accept a `forceAdmin` boolean parameter instead of mutating `ev` (`pseudoEvent`).
- [x] T016 [US2] Update `src/hooks/useStoreSync.ts` to only observe `useDataStore.ts` and add debounce to prevent rapid I/O writing.

**Checkpoint**: App is fully decoupled. Drag-and-drop and hotkeys are stable.

---

## Phase 5: User Story 4 - 响应式的 UI 布局与流畅的侧边栏 (Priority: P3)

**Goal**: Fix grid overlap on resize.

**Independent Test**: Resize the window horizontally; icons should wrap cleanly.

### Implementation for User Story 4

- [x] T017 [US4] Update `src/components/AppGrid.tsx` to replace explicit column repeat with `gridTemplateColumns: repeat(auto-fill, minmax(80px, 1fr))` in Tailwind or inline CSS.
- [x] T018 [US4] Remove forced `Math.min(400, ...)` hardcoding in `src/hooks/useTauriEvents.ts` (allow dynamic or relative width for drawer).

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T019 Run quickstart.md validation to ensure end-to-end functionality.
- [x] T020 Run TypeScript compiler (`npm run build`) to ensure 0 errors.
- [x] T021 Run `cargo clippy` in `src-tauri` to ensure Rust backend is warning-free.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: Can start immediately - BLOCKS all user stories
- **User Stories (Phase 2-5)**: All depend on Foundational phase completion
  - US1 and US3 (P1s) should be executed first.
  - US2 involves heavy React refactoring, should be done sequentially to avoid merge conflicts.
- **Polish (Phase 6)**: Depends on all user stories being complete.

### Parallel Opportunities

- All Foundational tasks marked [P] can run in parallel (T001, T002).
- Proxy fix (T005) and Store Extraction (T009, T010, T012, T013) can run in parallel since they touch different parts of the stack.

---

## Implementation Strategy

### MVP First (Security Fixes Only)

1. Complete Phase 1: Foundational
2. Complete Phase 2: User Story 1 (Admin Proxy Fix)
3. Complete Phase 3: User Story 3 (Parameter Fix)
4. **STOP and VALIDATE**: Test backend security and basic launching independently.

### Incremental Delivery

1. Complete backend MVP fixes.
2. Add User Story 2 (React Refactoring) → Test UI decoupling independently.
3. Add User Story 4 (CSS Grid Fix) → Test responsiveness.
4. Each phase adds value and stabilizes the codebase.
