---
description: "Task list template for feature implementation"
---

# Tasks: ui-settings-enhancement

**Input**: Design documents from `/specs/003-ui-settings-enhancement/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/tauri-ipc.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `src/`
- **Backend**: `src-tauri/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 [P] Install `zod` as a frontend dependency (e.g., `npm install zod`)
- [x] T002 Create `src/types/index.ts` to export Zod schemas based on `contracts/tauri-ipc.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Update `src-tauri/src/application/error.rs` to add `ParseError(String)` and `IoError(String)` to `ServiceError` enum
- [x] T004 [P] Create `src/api/tauri.ts` wrappers for new IPC commands: `load_apps`, `save_apps`, `restore_from_backup`, and `update_window_width`

**Checkpoint**: Foundation ready - error types and API wrappers available.

---

## Phase 3: User Story 1 - 修复高危缺陷与架构瓶颈 (Priority: P1) 🎯 MVP

**Goal**: 解决数据丢失漏洞（Data Loss）、存储与 IPC O(N) 性能瓶颈、以及前端 Zustand 和 React Context 的状态竞态分叉。

**Independent Test**: 破坏 `settings.json` 或 `apps.json` 后，应用能正确弹出恢复向导。拖拽应用排序时不触发全量配置写入，只增量保存 apps 数据。

### Implementation for User Story 1

- [x] T005 [P] [US1] Refactor `src-tauri/src/services/store_service.rs`: Split I/O, encryption, and validation. Implement Write-Rename atomic save and A/B `.bak` backup mechanism for both `settings.json` and `apps.json`
- [x] T006 [P] [US1] Update `src-tauri/src/application/commands.rs` to expose `load_apps`, `save_apps`, and `restore_from_backup` commands
- [x] T007 [P] [US1] Refactor `src/store/useDataStore.ts`: Add `settings` and `apps` state, implement Zod validation for incoming data, and split debounce logic for `saveSettings` and `saveApps`
- [x] T008 [US1] Remove `src/hooks/useSettings.tsx` and `src/hooks/useStoreSync.ts` completely (Resolve state fork)
- [x] T009 [US1] Refactor `src/components/SettingsWindow.tsx`, `src/App.tsx`, and `src/components/layout/TopBar.tsx` to read/write state exclusively via `useDataStore` instead of `useSettings` context
- [x] T010 [US1] Implement a Recovery Wizard Modal in `src/App.tsx` (or a dedicated component) that shows up when Zod parsing or Tauri `load_*` commands throw `ParseError`, with a button calling `restore_from_backup`

**Checkpoint**: At this point, User Story 1 should be fully functional. State is strictly managed by Zustand, IPC is split, and corrupted files trigger the recovery wizard safely.

---

## Phase 4: User Story 2 - 个性化布局定制 (Priority: P2)

**Goal**: 支持侧边栏左右停靠切换、动态调整应用宽度（基于网格列数），并恢复悬浮添加分类的功能。

**Independent Test**: 在设置中切换左右停靠，侧边栏立即改变位置且动画反转。修改列数，应用宽度无缝自动调整。

### Implementation for User Story 2

- [x] T011 [P] [US2] Update `src/store/useDataStore.ts` to include `columns` and `dockPosition` in default settings schema
- [x] T012 [P] [US2] Refactor `src/components/layout/Sidebar.tsx` to restore the hover "+" (Add Category) tooltip/button
- [x] T013 [US2] Refactor `src/App.tsx` container classes: Apply Flex direction-reverse based on `dockPosition` ('left' or 'right') to reposition Sidebar
- [x] T014 [US2] Refactor `src/App.tsx` entrance/exit animations (e.g., Tailwind translate classes) to flip direction based on `dockPosition`
- [x] T015 [US2] Refactor `src/App.tsx` or `useDataStore` to calculate and apply dynamic width `(columns * 80) + sidebarWidth + (padding * 2)` via `appWindow.setSize()` when `columns` changes

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Layout customization is fully operational.

---

## Phase 5: User Story 3 - 键盘无障碍漫游 (Priority: P3)

**Goal**: 实现基于二维网格的键盘焦点导航（Roving Tabindex），仅通过键盘即可启动应用。

**Independent Test**: 不使用鼠标，通过方向键能在 `AppGrid` 中顺滑穿梭，并在目标应用上按 Enter 启动。

### Implementation for User Story 3

- [x] T016 [P] [US3] Update `src/store/useUIStore.ts` to add `focusedAppId` state and setters
- [x] T017 [US3] Refactor `src/components/ShortcutItem.tsx` to conditionally apply focus styling and DOM focus based on `focusedAppId`
- [x] T018 [US3] Create `src/hooks/useGridNavigation.ts` to calculate next focused App ID based on current `columns` and `ArrowUp/Down/Left/Right` keystrokes
- [x] T019 [US3] Update `src/components/AppGrid.tsx` to attach `onKeyDown` handlers utilizing `useGridNavigation` and handle `Enter` key execution via `tauriApi.launchApp`

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T020 Run TypeScript compiler (`npm run build`) to ensure 0 errors after massive refactoring
- [x] T021 Run `cargo clippy --all-targets --all-features -- -D warnings` to ensure 0 warnings in Rust
- [x] T022 Run `quickstart.md` validation scenarios manually to ensure end-to-end functionality

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - Phase 3 (US1) must run before Phase 4 and 5 as it changes the core state management paradigm.
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P2)**: Must wait for US1 to finish replacing `useSettings` with `useDataStore`.
- **User Story 3 (P3)**: Can be implemented concurrently with US2, as it touches `AppGrid.tsx` while US2 touches `App.tsx` layout.

### Parallel Opportunities

- T005, T006, and T007 can be executed concurrently as they involve backend rewrite, command exposing, and frontend store rewrite independently.
- T011 and T012 can be executed concurrently.
- T016 can be executed concurrently with any task in US2.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1 (Deep refactor of state and storage)
4. **STOP and VALIDATE**: Verify data persistence and recovery wizard.

### Incremental Delivery

1. Foundation ready.
2. Deliver US1: Fast IPC, reliable storage, single state truth.
3. Deliver US2: Dynamic layout (columns & docking).
4. Deliver US3: Keyboard navigation.
5. Final polish and build checks.