# Implementation Plan: ui-settings-enhancement

**Branch**: `003-ui-settings-enhancement` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-ui-settings-enhancement/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

本计划旨在全面修复 `tertiary_defect_analysis_report` 中指出的关键架构与 UI/UX 缺陷，并引入用户高优需求。技术核心在于：1. 存储层引入 A/B 备份与 Write-Rename 原子操作彻底解决配置文件静默损坏 (Data Loss) 的致命漏洞。2. 分离 `settings.json` 与 `apps.json` 的存储与 IPC 同步通道，消除 O(N) 级别序列化带来的卡顿瓶颈。3. 在 React 端彻底铲除 `useSettings` 导致的状态竞态，实现唯一的 Zustand 状态源。4. 引入 Zod 强化类型安全，并在 Rust 端使用精准的 `ServiceError` 枚举替代 `unwrap_or` 的异常掩盖。5. 实现左右侧停靠切换、网格列数实装与窗口宽度自适应，以及基于方向键的二维键盘无障碍漫游 (Roving Tabindex)。注意：根据最新反馈，侧边栏悬浮添加分类的功能已被恢复。

## Technical Context

**Language/Version**: TypeScript (React 19), Rust 1.75+

**Primary Dependencies**: Tauri 2.0, Zustand, Tailwind CSS, dnd-kit, Zod (新增校验库)

**Storage**: 本地文件系统 (`settings.json` 和 `apps.json`)，采用 Write-Rename 与 A/B 备份机制。

**Testing**: 纯手工 E2E 测试 (quickstart.md) 与编译器静态类型检查 (`tsc` + `cargo clippy`)。

**Target Platform**: Windows 10/11 (桌面应用)

**Project Type**: 桌面应用程序前端与后端通信层

**Performance Goals**: 100个图标拖拽排序时，主线程阻塞时间 < 16ms。

**Constraints**: 必须确保与现有的 Windows OS 进程提权（Proxy Server）等核心逻辑无冲突；必须保证配置分离（增量同步）对上层渲染组件透明。

**Scale/Scope**: 重构涵盖全局状态管理、持久化 I/O 层、Tauri IPC 接口定义以及核心 UI 布局的深度改造。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. 专注于 Windows 平台与 Tauri 技术栈**: PASS。完全利用 Windows API 及 Tauri 优势。
- **II. 严格的代码规范与风格**: PASS。将在前端引入 Zod 约束，后端消灭 `unwrap_or`，严防类型逃逸。
- **III. 安全性与可靠性优先**: PASS。引入的 Write-Rename 原子写入与 A/B 备份专门为数据可靠性而设计。
- **IV. 高质量测试与文档要求**: PASS。将产出 `data-model.md`、`contracts` 以及严格的 `quickstart.md`。
- **V. 非破坏性修改与严谨交互**: PASS。重构将平滑迁移现有用户配置（需在代码中处理旧配置读取的兼容）。

## Project Structure

### Documentation (this feature)

```text
specs/003-ui-settings-enhancement/
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
├── store/
│   ├── useDataStore.ts      # 改造：增加左右停靠、列数等状态，彻底接管持久化同步
│   └── useUIStore.ts        # 改造：增加 A11y 焦点管理相关的状态
├── hooks/
│   ├── useSettings.tsx      # 删除/废弃（消除竞态分叉）
│   ├── useStoreSync.ts      # 改造：拆分 settings 和 apps 两个防抖通道
│   └── useGlobalShortcuts.ts
├── components/
│   ├── AppGrid.tsx          # 改造：二维键盘焦点漫游 (Roving Tabindex)
│   ├── SettingsWindow.tsx   # 改造：对接 useDataStore，引入 Zod 校验
│   └── layout/
│       ├── Sidebar.tsx      # 改造：适配左右停靠，保留悬浮添加分类按钮
│       └── GlobalContextMenu.tsx
├── types/
│   └── index.ts             # 改造：定义 Zod schema 并导出类型
├── App.tsx                  # 改造：动态计算窗口宽度，根据左右停靠翻转入场动画
└── api/
    └── tauri.ts             # 改造：新增 load_apps, save_apps 的 IPC 接口

src-tauri/
├── src/
│   ├── services/
│   │   ├── store_service.rs # 改造：分离读写、加密、校验，引入原子替换与A/B备份
│   │   └── execution_service.rs # 改造：消除 ununwrap_or 错误掩盖
│   ├── application/
│   │   ├── commands.rs      # 改造：对接拆分后的 settings/apps IPC
│   │   └── error.rs         # 改造：增加 ParseError 等具体枚举
│   └── main.rs
```

**Structure Decision**: 继续沿用现有的 Tauri 前后端分离架构。核心变动在于彻底废弃 React Context 的 `useSettings`，使 Zustand 成为绝对单一的真相源；后端通过细化 `store_service` 的职责边界来巩固架构稳定性。
