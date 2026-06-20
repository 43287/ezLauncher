# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

基于第二轮缺陷分析报告，完成前端深度解耦与 UI 状态清理任务。核心工作包括：彻底移除废弃的 `useAppStore.ts`，修复状态源分叉导致的数据不同步（特别是 Sidebar/TopBar 切换问题）；将 `App.tsx` 中的拖拽环境（`DndContext`）和右键全局菜单逻辑抽离为独立的组件或 Hook，实现根组件的极简化；优化 `AppGrid` 的数据过滤算法以提升性能；并增加无障碍相关的可见操作按钮。

## Technical Context

**Language/Version**: TypeScript (React 19)

**Primary Dependencies**: Zustand, dnd-kit, Tailwind CSS

**Storage**: Local File System (JSON settings) via Tauri IPC

**Testing**: Manual E2E via `quickstart.md`, TypeScript Compiler (`tsc`)

**Target Platform**: Windows 10/11 (Desktop App)

**Project Type**: Desktop Application (Launcher) Frontend

**Performance Goals**: AppGrid re-render latency < 50ms on category switch; O(N) filtering.

**Constraints**: Must maintain existing data structure compatibility.

**Scale/Scope**: Frontend refactoring of main UI components and state management.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **专注于 Windows 平台与 Tauri 技术栈**: Pass. Frontend interacts with existing Tauri commands.
- **严格的代码规范与风格**: Pass. 
- **安全性与可靠性优先**: Pass. Refactoring improves reliability by removing duplicated state sources.
- **高质量测试与文档要求**: Pass. Quickstart scenarios provided.
- **非破坏性修改与严谨交互**: Pass. Refactoring preserves existing features while improving code organization.

## Project Structure

### Documentation (this feature)

```text
specs/002-frontend-decoupling/
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
│   ├── useAppStore.ts       # Delete
│   ├── useDataStore.ts      # Modify: Consolidate data state
│   └── useUIStore.ts        # Modify: Consolidate UI state
├── components/
│   ├── providers/
│   │   └── DragDropProvider.tsx # New: Encapsulates DndContext
│   ├── layout/
│   │   ├── Sidebar.tsx      # Modify: Use new stores, add hover button
│   │   └── TopBar.tsx       # Modify: Use new stores, limit tabs
│   └── AppGrid.tsx          # Modify: O(N) filter
├── hooks/
│   └── useGlobalContextMenu.ts  # New: Extracted from App.tsx
└── App.tsx                  # Modify: Simplify drastically
```

**Structure Decision**: The frontend structure will be improved by moving providers to a dedicated directory and fully utilizing the separated Zustand stores. `useAppStore` will be completely removed.


