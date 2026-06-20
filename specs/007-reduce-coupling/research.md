# Research & Technical Decisions

## 1. Decoupling Business Logic from UI
**Decision**: Extract `buildLaunchContext` and the `handleLaunch` routing logic from `ShortcutItem.tsx` into a standalone `LaunchService.ts`.
**Rationale**: Adheres to the Single Responsibility Principle. UI components should only care about rendering and passing user intents. A separate service makes it trivial to write pure TypeScript unit tests for macro replacement without needing a DOM or Tauri context.
**Alternatives considered**: Custom React hooks (e.g., `useLauncher`). Rejected because business logic (like string manipulation and macro parsing) doesn't rely on React state or lifecycle, so it shouldn't be tied to React hooks.

## 2. Abstracting Tauri API (Adapter Pattern)
**Decision**: Create an `IPlatform` interface that defines all system-level capabilities needed by the app (e.g., `launchApp`, `hideWindow`, `loadSettings`). Implement a `TauriAdapter` that implements this interface by wrapping `tauriApi`.
**Rationale**: Allows the application to be completely decoupled from the specific desktop environment. In the future, a `BrowserMockAdapter` can be injected for testing or web-based previews without throwing `window.__TAURI__` undefined errors.
**Alternatives considered**: Keeping `tauriApi` but adding `if (window.__TAURI__)` checks everywhere. Rejected as it pollutes the codebase with environment checks and doesn't solve the structural coupling issue.

## 3. Dependency Injection in React
**Decision**: Export a singleton instance of `TauriAdapter` (or a factory function) from a central file (e.g., `src/api/platform/index.ts`) for now, rather than using complex Context-based DI containers.
**Rationale**: Keeps the refactoring lightweight and straightforward while still achieving the primary goal of abstracting the implementation details away from the components.
**Alternatives considered**: React Context for injecting the platform adapter. Rejected as overkill for the current scope, though it remains a viable path for the future if multiple adapters need to be swapped at runtime.
