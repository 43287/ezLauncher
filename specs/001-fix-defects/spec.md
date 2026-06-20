# Feature Specification: fix-defects

**Feature Branch**: `001-fix-defects`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "按照project_defect_analysis_report.md的缺陷，尝试修复和完善，要求对于各个组件进行编译和业务逻辑层面上的测试，通过后才算完成。"

## Clarifications

### Session 2026-06-20

- Q: 对于 FR-004（将 UI 交互状态和持久化数据隔离），倾向于哪种重构方案？ → A: 完全分离的 Stores（创建独立的 useUIStore 和 useDataStore，实现严格分离）
- Q: 对于 FR-010（改进错误处理为 AppError 增加详细枚举），前后端之间的错误传递契约倾向于哪种方式？ → A: 结构化 Error Code（将后端的 Error Code 和 Message 以结构化 JSON 形式传递给前端）
- Q: 对于 FR-008（修正前端网格列宽，避免图标重叠），推荐使用纯 CSS 原生方式还是基于 JS 动态计算？ → A: 纯 CSS repeat(auto-fill)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 管理员代理进程安全提权 (Priority: P1)

用户期望程序在请求管理员权限执行外部程序时，不会被本地恶意进程劫持。

**Why this priority**: 这是一个高危的本地提权漏洞 (LPE)。修复它确保了操作系统的安全。

**Independent Test**: 可以通过尝试连接 `ezlauncher_main_proxy_*.sock` 管道发送恶意命令。预期应该是管道拒绝连接或者命令被安全地拒绝执行，除非由合法的、经过签名校验的 `ezLauncher` 进程发起。

**Acceptance Scenarios**:

1. **Given** 用户以普通权限运行应用，**When** 用户触发管理员运行某个应用，**Then** 应用安全提权，且代理进程仅接受主进程发送的命令，恶意脚本无法注入命令。

---

### User Story 2 - 稳定的快捷键与拖拽体验 (Priority: P2)

用户在配置和使用全局快捷键、以及在应用内拖拽快捷方式时，期望应用保持流畅且不会崩溃。

**Why this priority**: "上帝组件"和事件篡改是导致应用不稳定和难以维护的核心原因。拆分后能显著提升代码质量和应用的防崩溃能力。

**Independent Test**: 用户能平滑地拖拽应用图标，快速点击标签页不会触发重复渲染警告。在应用处于后台时按下全局快捷键，应用能正确响应且不会有事件冲突。

**Acceptance Scenarios**:

1. **Given** 用户在网格内拖拽大量应用图标，**When** 图标顺序被改变，**Then** 界面不会卡顿，状态能够稳定保存，且控制台不报 Key 重复警告。
2. **Given** 用户尝试右键应用以管理员身份运行，**When** 用户点击"以管理员身份运行"，**Then** 程序正常以管理员权限拉起，React 控制台不报事件异常。

---

### User Story 3 - 准确无误的启动参数解析 (Priority: P1)

用户配置带有复杂参数（例如包含引号的路径）的快捷方式时，期望程序能准确无误地识别并传递给系统执行。

**Why this priority**: 参数解析错误直接导致用户无法启动目标程序，是核心功能级阻断 BUG。

**Independent Test**: 配置一个目标路径为 `"C:\Program Files\App.exe"` 且参数为 `"/path to/file" -arg` 的快捷方式并启动，目标程序能正确接收到参数。

**Acceptance Scenarios**:

1. **Given** 用户配置了包含转义和多重引号的参数，**When** 用户点击启动该应用，**Then** 应用能成功被拉起，参数完全不丢失且不被错误截断。

---

### User Story 4 - 响应式的 UI 布局与流畅的侧边栏 (Priority: P3)

用户期望在不同分辨率（尤其是 4K 及宽屏）下，应用网格能够合理换行，侧边栏能够根据屏幕宽度自适应或允许配置。

**Why this priority**: 影响高分辨率用户的核心体验。

**Independent Test**: 改变应用窗口大小，网格图标应当自动换行而不会挤压变形；在超宽屏下，侧边抽屉应当有更宽广的展示空间。

**Acceptance Scenarios**:

1. **Given** 用户缩小或放大应用窗口，**When** 宽度改变，**Then** 网格内的快捷方式图标自动增减列数并换行，文字和图标不重叠。

### Edge Cases

- What happens when 两个用户在不同的 Session 中同时启动应用？
- How does system handle 配置文件读写时的突发断电或磁盘满问题？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST 移除 `verify_parent_process` 中的 fallback 逻辑，采用严谨的 PID 传递和校验机制来防止本地提权漏洞。
- **FR-002**: System MUST 将 proxy 的同步网络 IO 从 Mutex 锁中移出，避免主线程阻塞。
- **FR-003**: System MUST 重构 `App.tsx`，将 `dnd-kit` 拖拽逻辑和全局快捷键拦截逻辑抽离为独立的 hooks（如 `useGlobalDragAndDrop`, `useGlobalShortcuts`）。
- **FR-004**: System MUST 将 UI 交互状态和需要持久化的领域数据从 `useAppStore` 中隔离（通过创建完全分离的独立的 `useUIStore` 和 `useDataStore` 实现）。
- **FR-005**: System MUST 使用 `crypto.randomUUID()` 替换 `Date.now().toString()` 生成列表 Key。
- **FR-006**: System MUST 废弃前端基于正则的参数拆解逻辑，改由后端 Rust 使用标准的命令行解析器（如 `shell-words`）处理。
- **FR-007**: System MUST 停止在前端篡改 React 合成事件 (`pseudoEvent`)，改用显式的 boolean 参数控制提权启动。
- **FR-008**: System MUST 修正前端网格列宽，改用原生的纯 CSS `repeat(auto-fill, ...)` 布局以保证原生性能和丝滑调整，避免图标重叠。
- **FR-009**: System MUST 修复 Rust 后端将 `&[u8]` 强转为可变指针 `*mut u8` 的未定义行为（UB）。
- **FR-010**: System MUST 改进错误处理，为 `AppError` 增加详细的枚举以便于前端分类处理，避免粗暴降级为字符串。前后端通过结构化 Error Code (JSON) 传递错误信息。

### Key Entities *(include if feature involves data)*

- **AppError/ServiceError**: 后端错误栈实体，需包含错误代码、类型及具体信息。
- **LaunchContext**: 启动上下文实体，需包含经过安全拆解的路径、参数列表及执行环境变量。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 安全性：所有的模拟提权劫持脚本均被 Proxy 拒绝（连接失败率 100%）。
- **SC-002**: 代码质量：`App.tsx` 的代码行数显著下降（至少减少 30%），拖拽和快捷键逻辑 100% 移入独立 hook。
- **SC-003**: 稳定性：连续拖拽 50 次应用图标，React 控制台不抛出任何 Duplicate Key 警告或合成事件警告。
- **SC-004**: 准确性：包含复杂转义引号的参数字符串，在后端解析后长度和内容 100% 匹配预期，无丢失或错误截断。
- **SC-005**: 通过编译与逻辑测试：Rust 后端无 Warning 及 Clippy 报错，TypeScript 前端 `tsc` 检查零报错。

## Assumptions

- 修复主要针对现有架构内的代码，不涉及底层依赖的更换（比如不替换 Zustand 或 Tauri）。
- 用户已安装并配置好 Rust 与 Node.js 的开发和编译环境。
