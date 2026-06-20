# Implementation Plan: deep-refactoring

**Branch**: `005-deep-refactoring` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-deep-refactoring/spec.md`

## Summary

本计划旨在执行第四期深度技术分析报告中指出的深层架构与性能缺陷修复：
1. 后端：引入后台线程异步处理数据 I/O 与 AES 加密；将臃肿的 `commands.rs` 拆分为按领域划分的模块；增加热键钩子的超时强制复位机制防死锁。
2. 前后端类型：引入 `ts-rs` 实现 Rust 结构体向 TypeScript Interface 的自动生成。
3. 前端：将 Store 中耦合的 Tauri IPC API 剥离，确保单一职责。

## Technical Context

**Language/Version**: Rust 1.75+, TypeScript (React 19)

**Primary Dependencies**: Tauri 2.0, rdev, ts-rs

**Storage**: Local JSON files (AES Encrypted) via Tokio async / std::thread

**Testing**: E2E 纯手工验收 (quickstart.md)

**Target Platform**: Windows 10/11 (桌面应用)

**Project Type**: 桌面应用程序前端与后端通信层

**Performance Goals**: 500 个快捷方式的高频拖拽操作下，前端主线程零卡顿，FPS >= 60。

**Constraints**: I/O 操作绝不能阻塞 Tauri 主事件循环；热键自愈机制不得引起误触发。

**Scale/Scope**: 重大架构调整。涉及前后端 IPC 层、存储服务层、前端状态管理层的重构。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. 专注于 Windows 平台与 Tauri 技术栈**: PASS。将深入使用 Tauri 后台线程。
- **II. 严格的代码规范与风格**: PASS。
- **III. 安全性与可靠性优先**: PASS。热键防死锁机制和原子写入机制正是为了提升可靠性。
- **IV. 高质量测试与文档要求**: PASS。包含明确的 `quickstart.md` 验收标准，并提供复杂度估算。
- **V. 非破坏性修改与严谨交互**: PASS。重构将平滑迁移，不丢失现有逻辑。

## Project Structure

### Documentation (this feature)

```text
specs/005-deep-refactoring/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (future)
```

### Source Code (repository root)

```text
src-tauri/
├── src/
│   ├── application/
│   │   ├── commands/          # [重构] 拆分为多个独立文件：app_cmds.rs, store_cmds.rs, hotkey_cmds.rs 等
│   │   └── mod.rs             # 暴露拆分后的 commands
│   ├── services/
│   │   ├── store_service.rs   # [改造] 引入异步后台线程写回
│   │   └── hotkey_service.rs  # [改造] 增加超时复位逻辑
│   └── domain/
│       └── models.rs          # [新增] 使用 ts-rs 定义前后端共享结构体

src/
├── store/
│   └── useDataStore.ts        # [改造] 剥离 API 调用
├── api/
│   └── tauri.ts               # [改造] 处理后端的异步 IPC 和防抖队列
└── types/
    └── bindings.d.ts          # [新增] 由 ts-rs 自动生成的类型定义
```

**Structure Decision**: 采用解耦的领域模块划分。后端拆分 IPC 入口，前端剥离 Store 的副作用。