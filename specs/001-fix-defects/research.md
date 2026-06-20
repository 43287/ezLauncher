# Research: fix-defects

## Technical Context Unknowns Resolved

1. **Rust Error Handling Strategy**:
   - *Decision*: Extend `AppError` and `ServiceError` enums, implement `serde::Serialize` for `AppError` to map to JSON structure `{ "code": "...", "message": "..." }`. Use `thiserror` for transparent conversion.
   - *Rationale*: Solves FR-010 by providing structured errors to the frontend instead of raw strings. Matches Rust best practices for error boundaries in Tauri.

2. **Command Line Argument Parsing (Rust)**:
   - *Decision*: Introduce the `shell-words` crate in `Cargo.toml`.
   - *Rationale*: Resolves FR-006. `shell-words::split` correctly handles quotes, spaces, and escape sequences on Windows, eliminating the brittle Regex in TypeScript.

3. **React State & Dnd-kit Extraction**:
   - *Decision*: Create two new hooks: `useGlobalShortcuts.ts` and `useGlobalDragAndDrop.ts`. Refactor `useAppStore` into `useDataStore.ts` (persisted apps) and `useUIStore.ts` (active tabs, modals).
   - *Rationale*: Solves FR-003 and FR-004. Strictly separates UI state from domain data, reduces `App.tsx` lines, and fixes unnecessary renders.

4. **Tauri Mutex & Async I/O**:
   - *Decision*: Use `std::sync::mpsc` channel or `tokio::sync::mpsc` to offload proxy writing/reading to a dedicated async thread, out of the `Mutex` lock in `proxy_server.rs`.
   - *Rationale*: Solves FR-002. Prevents the proxy lock from freezing the main Tauri command threads.

5. **React 19 Event Modification**:
   - *Decision*: Instead of `pseudoEvent = { ...ev, shiftKey: true } as React.MouseEvent`, pass a distinct parameter `forceAdmin: boolean` down to the `handleLaunch` function.
   - *Rationale*: Solves FR-007. React 19 strictly forbids mutating SyntheticEvents.
