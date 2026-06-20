# Research & Technical Decisions: ui-settings-enhancement

## 1. Zod Schema 校验与运行时类型守卫
**Decision**: 引入 `zod` 作为前端运行时 Schema 校验库。
**Rationale**: `tertiary_defect_analysis_report` 指出前端 `useSettings.tsx` 中存在过度的防御性编程与类型逃逸（`any`）。Zod 能够在运行时严格校验从 Rust (Tauri IPC) 返回的 JSON 数据结构，并在校验通过后自动推导出严格的 TypeScript 类型，消灭隐式或显式的 `any`，彻底满足 `FR-009` 的要求。
**Alternatives considered**:
- `yup`: 体积稍大，且对 TypeScript 类型推导的支持不如 Zod 原生。
- 手动编写 Type Guard 函数：代码量大，容易遗漏边界情况，维护成本高。

## 2. 存储层原子操作与 A/B 备份机制 (Write-Rename)
**Decision**: 在 Rust 端的 `store_service.rs` 中，保存数据时先写入 `.tmp` 临时文件，同步落盘（`sync_all`）后，通过操作系统的文件重命名 API（如 Windows 下的 `MoveFileEx` / `fs::rename`）原子性地覆盖目标文件。同时，在写入前将旧文件拷贝为 `.bak` 作为缓冲备份。
**Rationale**: 满足 `FR-003` 防损坏要求。如果发生断电或程序崩溃，由于重命名是操作系统级原子操作，原始文件绝不会处于“写了一半”的损坏状态。解密失败时，可以直接向用户暴露错误并提供从 `.bak` 恢复的选项。
**Alternatives considered**:
- SQLite 数据库：对于一个简单的配置与应用列表而言，引入完整的 SQL 引擎过于沉重，且与当前全 JSON 结构的架构冲突太大。
- 仅做追加写入日志（Append-only Log）：对于频繁全量更新的 UI 排序状态而言不适合，会导致日志文件迅速膨胀。

## 3. IPC 通信配置表拆分
**Decision**: 将原有的单个 `settings.json` 拆分为两个独立的物理文件与 IPC 通道：`settings.json`（轻量级，仅存通用设置）和 `apps.json`（重量级，存快捷方式列表）。
**Rationale**: 满足 `FR-008`，解决 O(N) 级别序列化造成的卡顿。用户拖拽调整应用顺序时，只触发 `apps.json` 的保存；修改主题、网格列数时，只触发 `settings.json` 的保存。防抖通道（Debounce）也从一个拆分为两个独立通道。
**Alternatives considered**:
- 增量 Patch 同步：每次只传递改变的单个 App 的 Index。由于前端状态管理使用的是 Zustand 引用替换（Immutable），计算增量 Diff 的开销和维护成本反而远高于直接传递一个仅包含 Apps 的中等大小 JSON 数组。

## 4. 键盘二维漫游 (Roving Tabindex)
**Decision**: 在 `AppGrid.tsx` 中利用 React 的 `useRef` 收集所有 Grid Item 的引用。通过监听 `keydown` 事件，结合当前设置的“网格列数”，动态计算出上下左右的逻辑目标索引，手动调用 `.focus()`。
**Rationale**: 这是实现 `FR-007` 无障碍键盘漫游最符合 React 模式的方案。比利用 HTML 原生的 `tabindex` 顺次切换更适合网格（Grid）布局，能够正确处理跨行的 `ArrowUp` 和 `ArrowDown`。
**Alternatives considered**:
- 原生 CSS `nav-up` / `nav-down`：目前浏览器支持度极差，无法投入生产。

## 5. 动态窗口宽度自适应
**Decision**: 在 Tauri 后端暴露出设置窗口尺寸的 IPC API，或者前端通过 `@tauri-apps/api/window` 模块中的 `appWindow.setSize()` 方法，在监听到 Zustand 中 `columns` 变化时动态调整。公式为：`(columns * 80) + sidebarWidth + (padding * 2)`。
**Rationale**: 满足 `FR-005`。Tauri 允许前端直接操作物理窗口大小。为了实现平滑过渡，可以在前端调用前利用 CSS transition 让内部元素先排列好，再调整外部窗框。