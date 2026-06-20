# Feature Specification: Reduce Coupling

**Feature Branch**: `007-reduce-coupling`

**Created**: 2026-06-21

**Status**: Draft

**Input**: User description: "我进行了多次缺陷分析，为什么每一次都会有强耦合的情况？是否有方法一次性地减少耦合？让代码更有结构"

## Why
在多次缺陷分析中，项目暴露出前端UI组件（如 `ShortcutItem`）与底层Tauri API、业务逻辑（如宏替换、进程启动判定）强耦合的问题。这种高耦合度不仅导致UI组件难以单独测试，也阻碍了代码的复用和后续的跨平台演进。为了一次性减少耦合，需要引入适当的架构模式（如分层架构、Adapter模式或依赖注入），使业务逻辑和UI展示分离。

## Clarifications

### Session 2026-06-21
- Q: Where should the newly decoupled `buildLaunchContext` and execution routing logic be placed? → A: src/services (Recommended)
- Q: How should the new `IPlatform` abstraction be injected or provided to the React components? → A: Singleton Export (Recommended)
- Q: To enforce Single Responsibility on `ShortcutItem.tsx`, how should it communicate the user's intent to launch an app? → A: Dumb Component with Callbacks (Recommended)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Decouple Launch Logic from UI Component (Priority: P1)

As a developer, I want the launch context building and process execution logic to be separated from the `ShortcutItem` UI component so that the component only handles presentation and user interaction.

**Why this priority**: `ShortcutItem` is a highly reused component that currently acts as a "God Component". Decoupling it significantly improves maintainability and testability.

**Independent Test**: Can be fully tested by verifying that clicking a shortcut still correctly launches the application, but the `ShortcutItem` code itself contains no macro replacement logic.

**Acceptance Scenarios**:

1. **Given** a configured shortcut, **When** the user clicks to launch it, **Then** the UI component fires an `onLaunch` callback, delegating the launch request to the parent component which utilizes the service layer.
2. **Given** a unit testing environment without Tauri, **When** the UI component is rendered and clicked, **Then** it does not throw an error about missing Tauri APIs because the service is mocked.

---

### User Story 2 - Abstract Tauri API Interactions (Priority: P2)

As a developer, I want all direct calls to `tauriApi` within React components to be abstracted behind a service interface, allowing for easy mocking and potential future migration to other environments (e.g., Web).

**Why this priority**: Direct `tauriApi` calls scatter system dependencies throughout the React tree.

**Independent Test**: Can be fully tested by replacing the real Tauri implementation with a mock implementation in the browser and verifying the UI still functions (e.g., settings save attempts call the mock without crashing).

**Acceptance Scenarios**:

1. **Given** a user action that requires saving settings, **When** the action is performed, **Then** the component calls an abstracted interface (`ISettingsService`) rather than `tauriApi` directly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extract the `buildLaunchContext` macro replacement logic out of `ShortcutItem.tsx` into a dedicated pure function or service in `src/services/LaunchService.ts`.
- **FR-002**: System MUST extract the process execution routing (`cmd /c start`, browser launch, admin launch) out of `ShortcutItem.tsx` into `src/services/LaunchService.ts`.
- **FR-003**: System MUST provide an abstraction layer for Tauri API calls by exporting a singleton `IPlatform` instance from `src/api/platform/index.ts`.
- **FR-004**: System MUST ensure `ShortcutItem.tsx` becomes a Dumb Component, only receiving `app` data and firing an `onLaunch` callback to the parent, adhering to the Single Responsibility Principle.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `ShortcutItem.tsx` line count is reduced by at least 40% due to logic extraction.
- **SC-002**: 100% of macro replacement and execution logic resides outside of `.tsx` UI components.
- **SC-003**: React components can be rendered in a standard browser environment (without Tauri injected) without throwing immediate `window.__TAURI__` undefined errors.

## Assumptions

- The project will continue using React and TypeScript.
- The backend Rust architecture is already reasonably decoupled and this effort focuses primarily on the frontend TypeScript/React layer where the coupling was most recently identified.
- Zustand stores may need minor adjustments if they directly call Tauri APIs.