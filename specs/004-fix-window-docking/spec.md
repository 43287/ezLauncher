# Feature Specification: fix-window-docking

**Feature Branch**: `004-fix-window-docking`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "尝试修复以下bug：1.窗口不能正常停靠在屏幕边沿 2.窗口长度计算有误，目前放下4个应用会导致下方出现横向滚动条且最后一个应用只能显示一半 3.我希望点击加号时不会显示“添加分类”四个文字"

## Clarifications

### Session 2026-06-20

- Q: 您提到“感觉是以左上角来计算的位置然后长度变化后按左上角的位置来固定的”，为了解决拖入内容后窗口重置偏离边缘的问题，我们应该如何定义窗口尺寸变化时的“锚点（Anchor）”？ → A: 按停靠方向固定锚点（在右停靠模式下，始终保持右侧贴边。在左停靠模式下，始终保持左侧贴边。这是最符合逻辑的锚点行为）。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 修复窗口尺寸与停靠位置计算 (Priority: P1)

作为一名用户，我希望应用的窗口能够严丝合缝地停靠在屏幕的最边缘，并且应用内部的网格计算是精准的，即使设置了4列应用，也能完整显示所有应用而不会触发横向滚动条或遮挡。

**Why this priority**: 窗口位置不准和出现横向滚动条严重影响了启动器作为“悬浮面板”的沉浸式视觉体验，是上一轮重构遗留的最核心 UI Bug。

**Independent Test**: 
1. 在设置中将网格列数设定为 4，面板内刚好能显示 4 列完整的图标，没有横向滚动条。
2. 不论设置左侧还是右侧停靠，面板呼出后必然紧贴屏幕对应的物理边缘，没有 1px 的缝隙。
3. 当拖入内容、修改配置导致窗口高度或宽度重新计算时，窗口必须以其停靠侧为锚点进行伸缩，绝不能重置回偏离边缘的位置。

**Acceptance Scenarios**:

1. **Given** 用户设置了 4 列网格，**When** 打开应用主界面，**Then** 主界面内刚好能够容纳 4 个完整的应用图标，右侧无截断，底部无横向滚动条。
2. **Given** 用户设置为右侧停靠，**When** 唤醒应用，**Then** 应用窗口的最右边缘必须与显示器的最右边缘 X 坐标完美重合。

---

### User Story 2 - 优化“添加分类”按钮提示 (Priority: P2)

作为一名用户，我希望侧边栏底部的加号 (`+`) 按钮保持极简，当我的鼠标悬停在上面时，不需要弹出带有“添加分类”文字的系统原生 tooltip 提示。

**Why this priority**: 这是一个微小的 UX 优化需求，满足了用户对极致极简界面的偏好。

**Independent Test**: 将鼠标悬停在侧边栏底部的 `+` 按钮上，停留几秒钟，不会出现任何包含文字的黑色/白色小提示框。

**Acceptance Scenarios**:

1. **Given** 侧边栏底部的加号按钮存在，**When** 用户的鼠标长时间悬停在该按钮上，**Then** 不会触发浏览器默认的 `title` 或其他文本 tooltip。

---

### Edge Cases

- 用户的屏幕由于缩放比例（Scale Factor，如 125%, 150%）导致逻辑像素计算出现小数位，如何确保计算出的窗口物理宽度和 X 坐标不产生 1px 的白边偏移？
- Tauri 的 `window.set_size` 和 `window.set_position` 是否因为调用顺序或异步延迟，导致窗口出现瞬间的闪烁或位移不准？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 前端 MUST 精确计算包含 Padding、Gap、以及 Scrollbar 预留空间的物理总宽度。
- **FR-002**: 前端 `AppGrid` 容器 MUST 禁用横向滚动条（`overflow-x-hidden`），以防止内容宽度溢出引发滚动。
- **FR-003**: 后端 `update_window_width` 指令 MUST 获取精确的屏幕缩放因子（`scale_factor`）。在调整宽度或高度时，系统 MUST 根据 `is_left_dock` 的值动态锚定 X 坐标：左停靠固定 `X=0` 向右伸展；右停靠固定 `X = 屏幕逻辑宽度 - 窗口逻辑宽度` 向左伸展，杜绝尺寸变化时原点偏移的问题。
- **FR-004**: 前端 MUST 移除侧边栏 `+` 按钮上的 HTML `title` 属性或相关的 aria-label tooltip，确保悬停时无文本提示。

### Key Entities

无新增数据实体。主要涉及对 UI 渲染计算逻辑的调整。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 无论在 100%, 125%, 还是 150% 屏幕缩放比例下，窗口贴边误差必须绝对等于 0 像素。
- **SC-002**: 在 1-12 任意网格列数设置下，网格右侧最后一个图标的右边缘距离滚动条的间距保持一致（不小于 4px），且绝对不触发横向滚动条。
- **SC-003**: `+` 按钮的鼠标悬停测试中，等待 5 秒内没有任何文字 tooltip 弹出。

## Assumptions

- 假设由于 Tailwind CSS 的 `gap` 和 `padding` 计算可能被忽略，之前的宽度公式 `(columns * 84)` 是不精确的，需要根据实际 DOM 结构重新调整参数。
- 假设 Windows 系统的部分版本会为隐藏的滚动条预留物理宽度，可能需要额外增加一个固定的 Scrollbar 补偿宽度（如 10px-15px）。