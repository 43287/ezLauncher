# Feature Specification: frontend-decoupling

**Feature Branch**: `002-frontend-decoupling`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "根据secondary_defect_analysis_report继续完成任务"

## Clarifications

### Session 2026-06-20

- Q: 对于 FR-007（为“新建标签页”和“新建分类”补充显式的可点击按钮），您更倾向于将按钮放置在哪里以及何种显示策略？ → A: 横向tab不能新建，且限制为4个，纵向可新建，悬浮时显示
- Q: 对于 FR-004（封装 DndContext），您更倾向于哪种组件架构方案？ → A: 提取为 Provider 组件（创建 `DragDropProvider.tsx` 封装所有拖拽逻辑）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 彻底清理与解耦前端状态源 (Priority: P1)

用户在使用左侧边栏（Sidebar）和顶部导航栏（TopBar）切换分类时，期望应用网格和数据能够正确地实时响应并持久化。

**Why this priority**: 这是二次深度分析报告中指出的唯一的高危阻断级 BUG。老旧的 `useAppStore` 与新抽离的 Store 平行存在，导致了数据写入和视图读取的完全割裂。

**Independent Test**: 点击左侧边栏的不同分类，顶部标签页应随之切换，且网格内的应用列表能瞬间更新。重启应用后，最后选中的标签状态和应用数据不丢失。

**Acceptance Scenarios**:

1. **Given** 用户打开应用，**When** 用户点击侧边栏的"游戏"分类，**Then** 右侧界面刷新展示游戏分类下的标签页和应用列表。
2. **Given** 用户在当前分类下新增了一个应用，**When** 应用被添加，**Then** 该应用被正确保存到磁盘配置文件中。

---

### User Story 2 - App 根组件深度解耦 (Priority: P2)

开发者或用户在扩展功能时，期望核心容器保持轻量级，右键菜单和拖拽环境不应直接堆砌在顶层逻辑中。

**Why this priority**: 上帝组件的残留逻辑仍影响着项目的可维护性，将拖拽环境与菜单拆分是现代化 React 应用的标准实践。

**Independent Test**: 在应用网格中右键空白处，能正常弹出全局菜单并添加应用；拖拽应用时，DndContext 的事件能被正确派发。

**Acceptance Scenarios**:

1. **Given** 用户在应用主界面的任意空白处点击右键，**When** 右键菜单触发，**Then** 正确展示"添加应用"等选项。

---

### User Story 3 - 补全无障碍与隐藏交互的入口 (Priority: P3)

对于不熟悉快捷键或无法双击的无障碍设备用户，期望能有明确的按钮来完成“新建分类/标签”等操作。

**Why this priority**: 补齐 UX 的最后一块短板，提升应用的普适性和包容度。

**Independent Test**: 在标签栏（TopBar）和分类栏（Sidebar）区域，可以看到显式的 "+" 或 "新建" 按钮并可点击操作。

**Acceptance Scenarios**:

1. **Given** 用户浏览顶部标签栏，**When** 鼠标悬浮或聚焦，**Then** 可以看到明确的添加标签页按钮。

### Edge Cases

- What happens when 旧版配置文件中包含了遗留的 `useAppStore` 结构，新版本该如何无缝迁移？
- How does system handle 拖拽过程中突然切换分类导致的数据保存冲突？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST 彻底删除 `src/store/useAppStore.ts` 文件。
- **FR-002**: System MUST 重构 `Sidebar.tsx` 和 `TopBar.tsx`，将所有状态读写调用迁移至 `useDataStore` 和 `useUIStore`。
- **FR-003**: System MUST 重构 `useGlobalDragAndDrop.ts`，修复或完善任何依然残留对 `useAppStore` 依赖的地方。
- **FR-004**: System MUST 将 `App.tsx` 中的 `<DndContext>` 及其相关的 sensors 封装为一个独立的 `<DragDropProvider>` 组件，App 根组件仅负责挂载该 Provider。
- **FR-005**: System MUST 将 `App.tsx` 中针对空白区域的右键全局菜单逻辑 (`onContextMenu`) 提取到独立的 Hook (例如 `useGlobalContextMenu`) 或组件中。
- **FR-006**: System MUST 优化 `AppGrid.tsx` 中的过滤算法，将基于 `reduce` 的对象字典构建改写为单次 O(N) 复杂度的 `filter` 遍历。
- **FR-007**: System MUST 针对侧边栏（纵向）补充悬浮时显示的“新建分类”按钮；同时明确横向顶部标签页（TopBar）不可新建，且严格限制最多为 4 个。

### Key Entities *(include if feature involves data)*

- **DataStore / UIStore**: 前端的核心状态引擎，必须严格遵循单一数据源原则（Single Source of Truth）。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 架构纯粹性：全局搜索 `useAppStore`，返回结果数量必须为 0。
- **SC-002**: 功能连贯性：切换侧边栏时，`AppGrid` 的重渲染延迟不得超过 50ms，且数据与视图完全一致。
- **SC-003**: 代码质量：`App.tsx` 的代码行数进一步降低（预期在 100 行左右）。
- **SC-004**: 算法优化：`AppGrid` 中计算 `filteredApps` 的时间复杂度由 2N 降为单次 N。

## Assumptions

- 后端的 API 与数据存储接口（Tauri Commands）在第一轮重构中已经稳定，本次纯粹为前端业务逻辑重构。