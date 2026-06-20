# Research & Technical Decisions: fix-window-docking

## 1. 窗口动态尺寸的锚点 (Anchor) 重算机制
**Decision**: 在 Rust 端的 `update_window_width` 命令中，不再只调用 `set_size`。而是引入复合操作：获取当前的 `scale_factor` 和屏幕 `monitor` 尺寸，在 `set_size` 后，立即通过 `window.set_position` 重置物理坐标。
**Rationale**: 满足 `FR-003` 要求。Windows 默认以左上角为缩放锚点，当设置窗口宽度时（比如宽度变小），右侧边缘会向左收缩，导致出现缝隙。只有在每次改变尺寸后，主动计算并重置 `X = monitor_logical_width - new_window_logical_width`（右侧停靠），才能保证窗口无论怎么缩放，都能严密吸附在右侧。
**Alternatives considered**: 
- 在前端计算位置：不够精确，且会由于前端异步通信产生明显的画面闪烁。

## 2. 消除横向滚动条的宽度补偿公式
**Decision**: 调整 `App.tsx` 中的 `gridContainerWidth` 预估公式，增加固定的滚动条补偿宽度（Scrollbar Compensation），并在最外层网格容器上强加 `overflow-x-hidden`。
**Rationale**: 满足 `FR-001` 和 `FR-002`。原生 Windows 下，纵向滚动条会硬性吃掉大约 `10px - 15px` 的空间。之前我们仅按 `columns * 84` 计算，没有留出这部分冗余，导致最后一列被挤压从而触发横向滚动条。增加补偿并禁用横向滚动可以完美解决该问题。
**Alternatives considered**:
- 自定义无宽度 CSS 滚动条（`::-webkit-scrollbar`）：虽然可以解决挤压，但破坏了用户的系统原生视觉体验。

## 3. 移除原生 tooltip 提示
**Decision**: 直接在 `Sidebar.tsx` 中，找到 `+` 按钮，删除其 `title` 属性，并清理相关的 `aria-label`。
**Rationale**: 满足 `FR-004`。最直接有效的减法操作，完全符合用户需求。