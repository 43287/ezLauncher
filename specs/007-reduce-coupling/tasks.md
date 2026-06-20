---
description: "Task list for decoupling frontend UI from Tauri API and business logic"
---

# Tasks: Reduce Coupling

**Input**: Design documents from `/specs/007-reduce-coupling/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/frontend-components.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [x] T001 Create `src/api/platform/` directory
- [x] T002 Create `src/services/` directory

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T003 Create `LaunchContext` interface in `src/types/LaunchContext.ts` or append to existing types file.
- [x] T004 Create `IPlatform` interface in `src/api/platform/IPlatform.ts`
- [x] T005 Implement `TauriAdapter` class implementing `IPlatform` in `src/api/platform/TauriAdapter.ts`
- [x] T006 Export singleton platform adapter from `src/api/platform/index.ts`

**Checkpoint**: Foundation ready - Platform abstraction is available for services and components to consume.

---

## Phase 3: User Story 1 - Decouple Launch Logic from UI Component (Priority: P1) 🎯 MVP

**Goal**: Separate macro replacement and routing logic from `ShortcutItem.tsx`

**Independent Test**: Verify that clicking a shortcut correctly launches the application, but `ShortcutItem` code itself contains no macro replacement logic.

### Implementation for User Story 1

- [ ] T007 [P] [US1] Create `LaunchService.ts` in `src/services/LaunchService.ts`
- [ ] T008 [P] [US1] Extract `buildLaunchContext` function from `ShortcutItem.tsx` into `LaunchService.ts`
- [ ] T009 [US1] Extract `handleLaunch` routing and execution logic (including `hideWindow`) from `ShortcutItem.tsx` into `LaunchService.executeLaunch` method.
- [ ] T010 [US1] Refactor `LaunchService.executeLaunch` to use the injected `IPlatform` instead of direct Tauri calls.
- [ ] T011 [US1] Refactor `ShortcutItem.tsx` to accept an `onLaunch` or similar callback prop, or let it call `LaunchService` directly (if keeping it simple), but remove all internal logic. Ensure it is a "Dumb Component".
- [ ] T012 [US1] Update parent components (e.g., `AppGrid.tsx` or `ShortcutItem` props usage) to wire up the new launch flow if `ShortcutItem` was changed to emit events.

**Checkpoint**: At this point, `ShortcutItem.tsx` is decoupled from the business logic.

---

## Phase 4: User Story 2 - Abstract Tauri API Interactions (Priority: P2)

**Goal**: Abstract all direct calls to `tauriApi` within React components behind a service interface.

**Independent Test**: Verify the UI functions correctly (e.g., settings save attempts) while using the abstracted platform interface.

### Implementation for User Story 2

- [x] T013 [P] [US2] Update `useDataStore` or `App.tsx` (where initialization happens) to use the new platform abstraction for `loadSettings` and `loadApps`.
- [x] T014 [P] [US2] Update `tauri.ts` or directly replace usages of `tauriApi.saveSettings` / `tauriApi.saveApps` in frontend components to use the platform abstraction.
- [x] T015 [US2] Update any remaining direct `tauriApi` calls in React hooks (e.g., window resizing logic in `App.tsx`) to use the platform abstraction.
- [x] T016 [US2] Deprecate or remove `src/api/tauri.ts` if all its functions have been successfully migrated to the `TauriAdapter`.

**Checkpoint**: At this point, the React tree is fully decoupled from Tauri APIs.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T017 Code cleanup: remove unused imports in `ShortcutItem.tsx` and other refactored files.
- [x] T018 Run quickstart.md validation to ensure all features still work as expected.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 and US2 can theoretically run in parallel once the Foundation is ready, but US1 is the highest priority.
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently (Launch an app).