# Data Model: ui-settings-enhancement

本数据模型文档定义了拆分后的系统核心状态结构，用于指导 TypeScript (前端) 与 Rust (后端) 的双向契约开发。

## 1. 通用配置模型 (SettingsConfig)

对应持久化文件：`data/settings.json`

此模型包含所有轻量级的、非频繁修改的全局首选项。

### Fields

| Field Name | Type (TS) | Type (Rust) | Default | Description |
|---|---|---|---|---|
| `autoStart` | `boolean` | `bool` | `false` | 是否随系统开机启动 |
| `theme` | `'system' \| 'light' \| 'dark'` | `String` | `'system'` | UI 主题外观 |
| `columns` | `number` | `u32` | `4` | **(新增)** 主网格显示的列数，范围 1-12 |
| `dockPosition` | `'right' \| 'left'` | `String` | `'right'` | **(新增)** 主窗口停靠在屏幕边缘的方向 |
| `summonShortcut` | `string` | `String` | `'Alt+Space'` | 全局唤醒键盘快捷键 |
| `summonMouseShortcut` | `string` | `String` | `'Mouse4'` | 全局唤醒鼠标快捷键 |
| `activeLeftTab` | `string` | `String` | `'2'` | 最后一次选中的主分类 ID |
| `leftTabs` | `Tab[]` | `Vec<Tab>` | - | 侧边栏分类数据列表 |
| `topTabs` | `Record<string, Tab[]>` | `HashMap<String, Vec<Tab>>` | - | 顶部栏分页数据字典 |

---

## 2. 应用列表模型 (AppList)

对应持久化文件：`data/apps.json`

此模型包含所有用户添加的快捷方式信息，体积较大，拖拽排序等高频操作仅触发此模型的独立落盘。

### Fields

本质上是一个由 `LaunchItem` 组成的数组 (`LaunchItem[]` / `Vec<LaunchItem>`)。

#### LaunchItem 实体定义

| Field Name | Type (TS) | Type (Rust) | Default | Description |
|---|---|---|---|---|
| `id` | `string` | `String` | (UUID) | 唯一标识符 |
| `name` | `string` | `String` | - | 显示名称 |
| `executablePath` | `string` | `String` | - | 绝对执行路径 |
| `iconUrl` | `string \| undefined` | `Option<String>` | - | 图标协议 URL (`http://ezicon.localhost/...`) |
| `categoryId` | `string` | `String` | - | 所属的主分类 ID |
| `columnId` | `string` | `String` | - | 所属的顶部分页 ID |
| `shortcut` | `string \| undefined` | `Option<String>` | - | 独立启动该应用的快捷键 |
| `runAsAdmin` | `boolean` | `bool` | `false` | 是否使用 UAC 提权运行 |

---

## 3. Zustand 状态树 (前端 Store)

为了消灭竞态分叉，前端的 React Context 被废除，全部收编至以下两个 Zustand Store：

### useDataStore (持久化数据)
- `settings`: `SettingsConfig` 对象
- `apps`: `LaunchItem[]` 数组
- `updateSetting`: `(key: keyof SettingsConfig, value: any) => void`
- `setApps`: `(apps: LaunchItem[]) => void`
- **行为约定**: 该 Store 内部订阅修改事件，并分别向 Tauri IPC 发送防抖的 `save_settings` 和 `save_apps` 请求。

### useUIStore (UI 瞬态与焦点)
- `activeLeftTab`: 当前选中的主分类。
- `activeTopTab`: 当前选中的顶部分页。
- `focusedAppId`: **(新增)** 当前被键盘方向键选中的 App ID，用于 Roving Tabindex。
- `isDragging`: 是否正在进行拖拽。

---

## 4. 状态流转与持久化生命周期 (State Machine)

1. **App 启动**: 
   - 前端挂载。
   - 触发 `tauriApi.loadSettings()` 与 `tauriApi.loadApps()`。
   - Rust 后端检查对应的物理文件，若损坏则抛出 `ServiceError::ParseError`。
   - 前端若捕获到错误，弹出“恢复向导”模态框；若成功，写入 `useDataStore`。
2. **交互变更 (如更改列数)**:
   - 调用 `updateSetting('columns', 6)`。
   - Zustand 状态立刻更新，React 组件同步重绘拉宽窗口。
   - `useDataStore` 内置的 Settings 防抖器等待 500ms 后，触发 `save_settings` IPC。
   - Rust 后端执行 Write-Rename，覆盖 `settings.json`。
3. **交互变更 (如拖拽调整应用)**:
   - Dnd-kit `onDragEnd` 触发 `setApps(newAppsList)`。
   - Zustand 状态立刻更新。
   - `useDataStore` 内置的 Apps 防抖器等待 500ms 后，触发 `save_apps` IPC。
   - Rust 后端执行 Write-Rename，覆盖 `apps.json`。
