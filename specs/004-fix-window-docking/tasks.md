---
description: "Task list for feature implementation"
---

# Tasks: fix-window-docking

**Input**: Design documents from `/specs/004-fix-window-docking/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

*(No setup tasks required as this is an incremental fix on an existing project)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

*(No foundational tasks required)*

---

## Phase 3: User Story 1 - 修复窗口尺寸与停靠位置计算 (Priority: P1) 🎯 MVP

**Goal**: 确保应用窗口无论由于何种原因改变尺寸（例如拖入内容改变高度、修改列数改变宽度），其物理边界都能紧贴屏幕停靠侧边缘，并且不会出现横向滚动条。

**Independent Test**: 
1. 设置网格列数为 4，观察面板刚好显示 4 列完整图标，底部无横向滚动条。
2. 设置左侧或右侧停靠，唤醒应用，窗口最外边缘与显示器物理边缘严密重合，无缝隙。
3. 拖入内容使高度变化时，窗口不会偏离屏幕边缘。

### Implementation for User Story 1

- [x] T001 [P] [US1] 在后端 `src-tauri/src/application/commands.rs` 的 `update_window_width` 命令中，增加获取 `scale_factor` 和屏幕尺寸的逻辑，并在 `set_size` 后根据 `is_left_dock` 重新计算坐标并调用 `set_position`
- [x] T002 [P] [US1] 在前端 `src/App.tsx` 中，调整 `gridContainerWidth` 的预估计算公式，增加固定的滚动条补偿宽度（约 10px-15px）
- [x] T003 [P] [US1] 在前端 `src/App.tsx` 的网格主容器上增加 `overflow-x-hidden` 类名，强制隐藏横向滚动条以防止内容溢出

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 优化“添加分类”按钮提示 (Priority: P2)

**Goal**: 移除侧边栏添加分类按钮的系统原生 Tooltip 提示，保持极简 UX。

**Independent Test**: 将鼠标悬停在侧边栏底部的 `+` 按钮上几秒钟，不出现任何包含文字的小提示框。

### Implementation for User Story 2

- [x] T004 [P] [US2] 在前端 `src/components/layout/Sidebar.tsx` 中，移除 `+` 按钮（添加分类）的 `title` 属性及 `aria-label` 属性

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T005 运行 `pnpm tauri dev` 并进行 E2E 手工验证（依据 quickstart.md 验收各项修复是否符合预期）

---

## Dependencies & Execution Order

### Phase Dependencies

- **User Story 1 (P1)**: Can start immediately.
- **User Story 2 (P2)**: Can start immediately, completely independent from US1.
- **Polish (Final Phase)**: Depends on all user stories being complete.

### Within Each User Story

- Frontend and Backend tasks in US1 can be done in parallel, though both are required for the full US1 fix.
- US2 is an isolated UI fix and can be executed anytime.

### Parallel Opportunities

- T001 (Rust Backend), T002/T003 (React Frontend App.tsx), and T004 (React Frontend Sidebar.tsx) touch completely different files and can be executed entirely in parallel.

---

## Parallel Example: User Story 1 & 2

```bash
# Backend fixes:
Task: "T001 [P] [US1] 在后端 src-tauri/src/application/commands.rs ..."

# Frontend App.tsx fixes:
Task: "T002 [P] [US1] 在前端 src/App.tsx 中，调整 gridContainerWidth ..."
Task: "T003 [P] [US1] 在前端 src/App.tsx 的网格主容器上增加 overflow-x-hidden ..."

# Frontend Sidebar.tsx fixes:
Task: "T004 [P] [US2] 在前端 src/components/layout/Sidebar.tsx 中 ..."
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1
2. **STOP and VALIDATE**: Test User Story 1 independently (verify window snapping and grid scrolling)

### Incremental Delivery

1. Add User Story 1 → Test independently → Validate window sizing
2. Add User Story 2 → Test independently → Validate Tooltip removal
