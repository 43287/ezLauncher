# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

基于缺陷分析报告，重构与修复 ezLauncher。包括：修复 `proxy_server.rs` 中的本地提权漏洞，将网络 IO 从 Mutex 中移出；通过 `shell-words` 实现精准的命令行参数解析；解耦前端 `App.tsx` 中的 DND 和全局快捷键逻辑，分离 Zustand 状态；改用纯 CSS 实现网格的响应式布局，并结构化 Rust 到 TS 的错误传递。

## Technical Context

**Language/Version**: Rust 1.75+, TypeScript (React 19)

**Primary Dependencies**: Tauri 2.0, Zustand, dnd-kit, thiserror, shell-words

**Storage**: Local File System (JSON settings)

**Testing**: Manual E2E via `quickstart.md`, TypeScript Compiler (`tsc`), Rust Clippy

**Target Platform**: Windows 10/11 (Desktop App)

**Project Type**: Desktop Application (Launcher)

**Performance Goals**: Instant UI response on drag & drop; Non-blocking IPC commands.

**Constraints**: Must use Win32 API for Proxy/UAC elevation.

**Scale/Scope**: Single application with moderate complexity.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **专注于 Windows 平台与 Tauri 技术栈**: Pass. Uses Windows-specific local sockets and Win32 process APIs.
- **严格的代码规范与风格**: Pass. 
- **安全性与可靠性优先**: Pass. LPE vulnerability is specifically targeted for remediation.
- **高质量测试与文档要求**: Pass. Quickstart validation scenarios are defined.
- **非破坏性修改与严谨交互**: Pass. Refactoring focuses on extraction and decoupling without removing core features.

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-defects/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── store/
│   ├── useDataStore.ts      # New: Persisted state
│   └── useUIStore.ts        # New: Transient state
├── hooks/
│   ├── useGlobalDragAndDrop.ts  # New: Extracted DND logic
│   └── useGlobalShortcuts.ts    # New: Extracted Hotkey logic
├── components/
│   ├── AppGrid.tsx          # Modify: CSS repeat(auto-fill)
│   └── ShortcutItem.tsx     # Modify: Event fix
└── App.tsx                  # Modify: Simplify

src-tauri/src/
├── application/
│   └── error.rs             # Modify: Structured JSON error enum
├── services/
│   └── proxy_server.rs      # Modify: Security fix & Async IO
└── lib.rs                   # Modify: Error mapping
```

**Structure Decision**: The project maintains its existing Tauri structure. The frontend will see the addition of specific stores and hooks to enforce separation of concerns, while the backend receives targeted security and error handling updates in existing files.


