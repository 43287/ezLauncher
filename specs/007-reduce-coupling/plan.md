# Implementation Plan: Reduce Coupling

**Branch**: `007-reduce-coupling` | **Date**: 2026-06-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-reduce-coupling/spec.md`

## Summary

Decouple the frontend React UI components from Tauri APIs and complex business logic. This will be achieved by extracting macro replacement and process launch logic into a dedicated `LaunchService.ts` and abstracting `tauriApi` calls behind a platform adapter interface.

## Technical Context

**Language/Version**: TypeScript
**Primary Dependencies**: React 19, Tauri 2.0 API (`@tauri-apps/api`)
**Storage**: N/A
**Testing**: Setup for future unit tests (mocking PlatformAdapter)
**Target Platform**: Windows ONLY (Tauri Desktop App)
**Project Type**: Desktop App (Tauri) Frontend
**Performance Goals**: N/A (Focus on maintainability and structural clarity)
**Constraints**: 
- Must retain existing macro replacement logic (`{target_path}`, etc.) exactly as is, but moved out of the UI.
- Ensure the `ShortcutItem` UI component only handles React events (click, drag, hover).
**Scale/Scope**: Frontend architecture refactoring.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Windows Platform Only**: Compliant.
- **Strict Code Standards**: Compliant. Will use PascalCase for interfaces/classes and camelCase for instances.
- **High-Quality Testing & Docs**: Compliant. The primary goal is to make the frontend testable.
- **Non-destructive Modification**: Compliant. Logic is moved, not deleted.

## Project Structure

### Documentation (this feature)

```text
specs/007-reduce-coupling/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (to be generated)
```

### Source Code (repository root)

```text
src/
├── api/
│   ├── tauri.ts          # Will be refactored/wrapped by adapter
│   └── platform/         # New directory for platform adapters
│       ├── IPlatform.ts  # Abstract interface for system calls
│       └── TauriAdapter.ts # Tauri implementation
├── services/
│   └── LaunchService.ts  # Extracted launch logic (macro parsing, routing)
└── components/
    └── ShortcutItem.tsx  # Will become a "Dumb Component"
```

**Structure Decision**: Frontend Web application structure modification. Introducing `services/` and `api/platform/` layers to implement Ports and Adapters pattern.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations.*
