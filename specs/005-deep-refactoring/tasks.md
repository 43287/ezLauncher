---
description: "Task list for feature implementation"
---

# Tasks: deep-refactoring

**Input**: Design documents from `/specs/005-deep-refactoring/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 在 `Cargo.toml` 中引入 `ts-rs` 依赖
- [x] T002 在前端 `package.json` 的 scripts 中添加或修改用于生成 TS 类型的钩子（如适用）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T003 在后端 `src-tauri/src/domain/models.rs` 中使用 `#[derive(TS)]` 重新定义 `LaunchItem`, `SettingsConfig` 和 `Tab`，对齐现有的前端契约结构
- [x] T004 运行 `cargo test` 或相关构建命令生成前端类型，并在 `src/types/bindings.d.ts` 中完成类型引用的替换（修复因类型替换导致的前端编译报错）

---

## Phase 3: User Story 1 - 修复底层系统热键死锁隐患 (Priority: P1) 🎯 MVP

**Goal**: 确保在使用键盘钩子时，即使发生系统级焦点丢失（如 UAC 弹窗、锁屏），快捷键状态机也能自愈，不再发生无法唤醒程序的永久性死锁。

**Independent Test**: 
1. 按下系统全局修饰键（如 `Alt` 或 `Ctrl`）。
2. 在释放之前，模拟系统拦截或焦点丢失（如强制锁屏再解锁）。
3. 再次尝试呼出启动器的快捷键组合，应用能正常响应，说明状态机未被死锁。

### Implementation for User Story 1

- [x] T005 [US1] 在后端 `src-tauri/src/services/hotkey_service.rs` 中，为 `ModifiersState` 添加时间戳追踪字段
- [x] T006 [US1] 在 `handle_event` 和 `check_trigger` 流程中，加入超时逻辑：如果发现某修饰键按下时间超过阈值（如 5 秒），强制清空所有修饰键状态

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 优化数据读写性能与 I/O 效率 (Priority: P2)

**Goal**: 重构目前 `useDataStore` 中的全量写入防抖逻辑，避免在应用列表极大时，频繁的 JSON 序列化和 AES 加密导致前端主线程的卡顿掉帧。

**Independent Test**: 
在应用中导入 200+ 个快捷方式。尝试快速连续修改多个分类的名字或拖拽排序，界面的操作响应时间依然应当与空列表时一样顺滑。

### Implementation for User Story 2

- [x] T007 [P] [US2] 在前端 `src/store/useDataStore.ts` 中，将 `scheduleSaveApps` 和 `scheduleSaveSettings` 剥离，通过监听 Store 的变化或者放到独立的 Tauri API 包装层中触发
- [x] T008 [P] [US2] 在后端 `src-tauri/src/services/store_service.rs` 中，重构 `save_file` 方法，将 `crypto_service.encrypt_data` 和文件写入逻辑用 `tauri::async_runtime::spawn_blocking` 包裹，转入 Tokio 后台线程池

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - 重构前后端通信桥梁 (Priority: P3)

**Goal**: 解决目前 `src-tauri/src/application/commands.rs` 极其臃肿的“上帝对象”问题，将 IPC 接口按领域解耦拆分。

**Independent Test**: 
开发人员能够轻易地在独立的模块文件中找到对应领域（Domain）的 API。原有的所有功能（如启动应用、读取设置）正常运作。

### Implementation for User Story 3

- [x] T009 [US3] 在后端 `src-tauri/src/application/` 下新建 `commands` 文件夹，并创建 `app_cmds.rs`, `store_cmds.rs`, `hotkey_cmds.rs` 等文件
- [x] T010 [US3] 将原本在 `commands.rs` 中的宏指令按领域职责迁移至对应的新文件中，并在 `mod.rs` 中统一暴露
- [x] T011 [US3] 修改 `main.rs` 中 `tauri::generate_handler!` 的注册路径，对齐新的模块结构

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T012 运行 `pnpm tauri dev` 并进行功能回归测试，确保拖拽排序、热键唤醒、数据存取功能正常

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1, US2, US3 can then proceed in parallel (if staffed)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### Parallel Opportunities

- Phase 3 (US1: 热键修复), Phase 4 (US2: I/O 异步化), Phase 5 (US3: IPC 拆分) 涉及的代码文件基本互不干涉（`hotkey_service.rs` vs `store_service.rs` vs `application/commands/`），完全可以由多智能体/多开发者并行推进。

---

## Parallel Example: User Story 1, 2 & 3

```bash
# Developer A works on US1:
Task: "T005 [US1] 在后端 src-tauri/src/services/hotkey_service.rs 中，为 ModifiersState 添加时间戳追踪字段"

# Developer B works on US2:
Task: "T008 [P] [US2] 在后端 src-tauri/src/services/store_service.rs 中，重构 save_file 方法..."

# Developer C works on US3:
Task: "T009 [US3] 在后端 src-tauri/src/application/ 下新建 commands 文件夹..."
```

---

## Implementation Strategy

### Incremental Delivery

1. Complete Setup + Foundational → 解决前后端数据类型的基石
2. Add User Story 1 → Test independently → 修复高危死锁问题 (MVP)
3. Add User Story 2 → Test independently → 解决大容量下 I/O 阻塞前端问题
4. Add User Story 3 → Test independently → 完成架构重构，提升后续可维护性
5. 运行完整回归测试。