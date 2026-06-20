# Implementation Plan: Fix Core Defects

**Branch**: `006-fix-core-defects` | **Date**: 2026-06-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-fix-core-defects/spec.md`

## Summary

Refactor and fix 6 core technical defects in the ezLaunch Tauri application. The fixes target backend thread lifecycle management, Tauri IPC blocking, silent I/O failures, `.lnk` file resolution via Windows COM API, IPC error preservation, and memory safety (UB removal) in DPAPI cryptography.

## Technical Context

**Language/Version**: Rust (stable), TypeScript
**Primary Dependencies**: Tauri 2.0, `windows` crate, React 19
**Storage**: Local File System (JSON)
**Testing**: `cargo test`
**Target Platform**: Windows ONLY
**Project Type**: Desktop App (Tauri)
**Performance Goals**: Responsive UI (no event loop starvation), fast `.lnk` parsing
**Constraints**: 
- Must eliminate all Undefined Behavior (UB) in `crypto_service.rs`.
- Must handle graceful thread shutdown.
- Windows platform specific API usage is required.
**Scale/Scope**: Local desktop usage, high reliability requirements for I/O and process execution.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Windows Platform Only**: Compliant. All OS-specific fixes target Windows API (Win32).
- **No UB or Panic**: Compliant. Directly addressing a UB issue in DPAPI cryptography.
- **Test Coverage & Complexity**: Compliant. Changes will be accompanied by tests where applicable and complexity analysis.
- **Non-destructive Modification**: Compliant. Will preserve existing functionality while fixing defects.

## Project Structure

### Documentation (this feature)

```text
specs/006-fix-core-defects/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (to be generated)
```

### Source Code (repository root)

```text
src-tauri/src/
├── application/
│   ├── commands/
│   │   ├── app_cmds.rs       # Refactoring Tauri async commands
│   │   └── store_cmds.rs     # Refactoring I/O commands
│   └── error.rs              # Error type preservation
├── services/
│   ├── proxy_server.rs       # Thread shutdown & IPC fixes
│   ├── execution_service.rs  # .lnk resolution
│   ├── store_service.rs      # Async I/O fixes
│   └── crypto_service.rs     # UB fixes
src/
└── components/
    └── AppModals.tsx         # Toast notification integration (or similar UI component)
```

**Structure Decision**: Single Tauri application project. Modifications are scoped strictly to the existing backend services, commands, and minor frontend notification adjustments.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No constitution violations.*
