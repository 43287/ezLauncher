# Research: frontend-decoupling

## Technical Context Unknowns Resolved

1. **State Store Deletion**:
   - *Decision*: Completely delete `src/store/useAppStore.ts`. Any components importing it must be refactored to use `useDataStore` or `useUIStore`.
   - *Rationale*: Solves FR-001 and the P1 bug. Ensures a Single Source of Truth for the application state.

2. **DndContext Provider Architecture**:
   - *Decision*: Create `src/components/providers/DragDropProvider.tsx`. Move `DndContext`, `sensors` setup, and drag event handlers (`useGlobalDragAndDrop`) inside this provider. `App.tsx` will just wrap its children with `<DragDropProvider>`.
   - *Rationale*: Solves FR-004. Significantly reduces the size and complexity of `App.tsx`, separating drag-and-drop context from application layout.

3. **Global Context Menu Hook**:
   - *Decision*: Extract the global `onContextMenu` handler from `App.tsx` into `src/hooks/useGlobalContextMenu.ts`. This hook will consume `useModalStore` and `useDataStore`.
   - *Rationale*: Solves FR-005. Further decouples logic from the root component.

4. **AppGrid Filtering Algorithm**:
   - *Decision*: Replace the `reduce` + `filter` chain with a single `filter` operation over `useDataStore().apps`.
   - *Rationale*: Solves FR-006. Reduces memory allocations and time complexity from O(2N) to O(N).

5. **A11y Add Buttons**:
   - *Decision*: Update `Sidebar.tsx` to include an "Add Category" button that appears on hover (`group-hover:opacity-100`). Enforce a maximum limit of 4 tabs in `TopBar.tsx` and disable tab creation there.
   - *Rationale*: Solves FR-007. Improves UX for accessibility without cluttering the interface.
