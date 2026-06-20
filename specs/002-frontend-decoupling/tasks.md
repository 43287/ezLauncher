---
description: "Task list template for feature implementation"
---

# Tasks: frontend-decoupling

**Input**: Design documents from `/specs/002-frontend-decoupling/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/frontend-components.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `src/`

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Core data models and utilities needed across multiple components.

- [x] T001 [P] Delete `src/store/useAppStore.ts` completely
- [x] T002 Update `src/hooks/useGlobalDragAndDrop.ts` to ensure it only imports `useDataStore` and `useUIStore`, removing any references to `useAppStore`

**Checkpoint**: Foundation ready - legacy store removed, hooks updated.

---

## Phase 2: User Story 1 - 彻底清理与解耦前端状态源 (Priority: P1) 🎯 MVP

**Goal**: Ensure all components read and write to the correct, separated Zustand stores so UI updates and persistence work perfectly.

**Independent Test**: Click through Sidebar categories. TopBar and AppGrid should instantly update.

### Implementation for User Story 1

- [x] T003 [P] [US1] Refactor `src/components/layout/Sidebar.tsx` to read/write state using `useDataStore` and `useUIStore` instead of `useAppStore`
- [x] T004 [P] [US1] Refactor `src/components/layout/TopBar.tsx` to read/write state using `useDataStore` and `useUIStore` instead of `useAppStore`
- [x] T005 [P] [US1] Refactor `src/components/AppGrid.tsx` filtering algorithm to use a single O(N) `filter` operation over `useDataStore().apps` instead of `reduce`

**Checkpoint**: User Story 1 functional. Sidebar/TopBar navigation correctly updates the Grid without delays.

---

## Phase 3: User Story 2 - App 根组件深度解耦 (Priority: P2)

**Goal**: Extract dragging and context menu logic from `App.tsx` into standalone providers/hooks.

**Independent Test**: Drag and drop still works smoothly. Right-clicking the grid background still opens the add app context menu.

### Implementation for User Story 2

- [x] T006 [P] [US2] Create `src/hooks/useGlobalContextMenu.ts` and move the `onContextMenu` logic from `App.tsx` into it
- [x] T007 [P] [US2] Create `src/components/providers/DragDropProvider.tsx` and move `DndContext`, sensors setup, and `useGlobalDragAndDrop` handlers into it
- [x] T008 [US2] Refactor `src/App.tsx` to wrap its content in `<DragDropProvider>` and consume `useGlobalContextMenu`, removing inline drag/menu logic

**Checkpoint**: App root component is clean and declarative.

---

## Phase 4: User Story 3 - 补全无障碍与隐藏交互的入口 (Priority: P3)

**Goal**: Add explicit UI buttons for creating categories and tabs for better A11y.

**Independent Test**: Hovering over Sidebar shows an "Add Category" button. TopBar limits tabs to 4.

### Implementation for User Story 3

- [x] T009 [P] [US3] Update `src/components/layout/Sidebar.tsx` to render a visible "+" (Add Category) button when the sidebar is hovered
- [x] T010 [P] [US3] Update `src/components/layout/TopBar.tsx` to enforce a hard limit of 4 tabs and disable/hide the "Add Tab" ability if reached

**Checkpoint**: A11y features added. All user stories complete.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T011 Run TypeScript compiler (`npm run build`) to ensure 0 errors after refactoring
- [x] T012 Run quickstart.md validation to ensure end-to-end functionality

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: Must be completed first to enforce compile errors on any remaining `useAppStore` imports.
- **User Story 1 (Phase 2)**: Fixes the core P1 bug; requires Phase 1.
- **User Story 2 & 3 (Phase 3-4)**: Can be worked on in parallel after Phase 2, as they touch different parts of the UI/Architecture.

### Parallel Opportunities

- T001 and T002 can be run simultaneously.
- T003, T004, and T005 are independent component refactors and can be done in parallel.
- T006 and T007 are independent extractions.