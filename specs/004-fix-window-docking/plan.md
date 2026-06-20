# Implementation Plan: fix-window-docking

**Branch**: `004-fix-window-docking` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-fix-window-docking/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

本计划旨在修复目前主窗口位置在高度或宽度发生变化（例如拖拽内容、修改列数）时发生偏离的严重 UI Bug。核心方案是：在 Tauri 的 Rust 后端调整窗口大小（`setSize`）时，强制依据用户选择的 `dockPosition` 来计算并重置逻辑坐标（`setPosition`）。此外，前端的网格宽度计算公式将被调整，并强制隐藏横向滚动条以解决内容挤压的问题；同时，移除侧边栏添加按钮的原生 HTML `title` 提示。

## Technical Context

**Language/Version**: TypeScript (React 19), Rust 1.75+

**Primary Dependencies**: Tauri 2.0 (API/Window)

**Storage**: N/A

**Testing**: E2E 纯手工验收 (quickstart.md)

**Target Platform**: Windows 10/11 (桌面应用)

**Project Type**: 桌面应用程序前端与后端通信层

**Performance Goals**: 尺寸计算与重置操作必须在同一个事件循环内同步完成，避免可见的闪烁。

**Constraints**: 需要获取精确的屏幕缩放因子（`scale_factor`）以防止 1px 的缝隙。

**Scale/Scope**: 涉及少量的 Tauri 后端命令修改与前端 CSS/组件属性调整。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. 专注于 Windows 平台与 Tauri 技术栈**: PASS。将深入使用 Tauri 的 `WebviewWindow` API 获取物理屏幕尺寸与缩放比。
- **II. 严格的代码规范与风格**: PASS。
- **III. 安全性与可靠性优先**: PASS。
- **IV. 高质量测试与文档要求**: PASS。包含明确的 `quickstart.md`。
- **V. 非破坏性修改与严谨交互**: PASS。

## Project Structure

### Documentation (this feature)

```text
specs/004-fix-window-docking/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (future)
```

### Source Code (repository root)

```text
src/
├── App.tsx                  # 改造：修正 gridContainerWidth 计算公式
└── components/
    └── layout/
        └── Sidebar.tsx      # 改造：移除 title 与 aria-label

src-tauri/
├── src/
│   ├── application/
│   │   └── commands.rs      # 改造：在 update_window_width 中增加 set_position 锚定逻辑
│   └── main.rs
```

**Structure Decision**: 维持现状。仅对特定文件的逻辑进行微调。
