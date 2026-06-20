# Research & Technical Decisions: deep-refactoring

## 1. 键盘钩子超时复位机制 (Hotkey Timeout Flush)
**Decision**: 在 Rust 的 `hotkey_service.rs` 中引入基于系统时间的探针机制。每次更新修饰键（Modifiers）按下状态时记录时间戳；在每次键入检查时，如果发现某个修饰键已被按下超过指定阈值（例如 5000 毫秒）但未收到释放事件，则强行将所有修饰键状态置为 `false`。
**Rationale**: 满足 User Story 1 (FR-001)。解决 UAC 弹窗、焦点丢失、系统锁屏导致的底层 `KeyRelease` 事件丢失而造成的永久性死锁。这是最轻量、不依赖系统特定平台 API 的通用解法。
**Alternatives considered**:
- 监听 Windows Session 变化事件：过于复杂，且无法覆盖所有由于失去焦点导致的丢键场景。

## 2. 异步后台写回策略 (Async I/O Offloading)
**Decision**: 改造 `store_service.rs`，在处理全量序列化和 AES 加密写入时，使用 `tauri::async_runtime::spawn_blocking` 将 I/O 任务卸载至 Tokio 的后台线程池。
**Rationale**: 满足 User Story 2 (FR-002)。当列表元素成百上千时，加密和序列化是 CPU 密集型任务。通过将其推入后台线程，能确保 Tauri 主事件循环不被阻塞，前端的动画和拖拽保持 60FPS 的丝滑体验。
**Alternatives considered**:
- 引入 SQLite 或 IndexedDB 增量同步：虽然能彻底解决全量写入问题，但会导致现有的纯文本 JSON 备份体系崩溃，改造成本和回归风险过高。

## 3. IPC 层模块拆分解耦 (Domain-driven IPC)
**Decision**: 将原本拥有 15 个独立指令的 `application/commands.rs` 拆分为：
- `application/commands/app_cmds.rs`：负责应用启动、获取系统应用等。
- `application/commands/store_cmds.rs`：负责设置、应用列表的持久化存取。
- `application/commands/hotkey_cmds.rs`：负责全局快捷键注册等。
- `application/commands/mod.rs`：统一聚合导出。
**Rationale**: 满足 User Story 3 (FR-003)。降低代码圈复杂度，遵循单一职责原则，使得项目更易于多人协作和后期维护。

## 4. 前端 Store 剥离副作用 (Decoupling Frontend Side-effects)
**Decision**: 将 `useDataStore.ts` 中现有的 `scheduleSaveApps` 和 `scheduleSaveSettings` 等涉及 Tauri API 调用的逻辑移出 Store 内部定义，转为在应用顶层或中间件中通过订阅 Store 变化（`useDataStore.subscribe`）来触发。
**Rationale**: 满足 FR-004。Store 应只关注状态的读写（纯函数或简单的 reducer），不应耦合底层跨语言通信，便于后期编写纯粹的前端单元测试。

## 5. 前后端类型自动生成 (Type Auto-generation via ts-rs)
**Decision**: 在 Cargo.toml 中引入 `ts-rs` 依赖。在 Rust 端的 `domain/models.rs` 中定义 `LaunchItem` 和 `SettingsConfig` 等结构体，并派生 `#[derive(TS)]`，在构建前自动将类型导出到前端 `src/types/bindings.d.ts`。
**Rationale**: 满足 FR-005。消除前后端类型依靠人工维护可能导致的字段错位或缺失问题，实现 Type-Safe IPC。
**Alternatives considered**:
- Schema 优先生成：由于项目规模不大，无需引入额外的 OpenAPI 流程，`ts-rs` 更加轻量且契合当前技术栈。