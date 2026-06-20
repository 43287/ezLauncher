# IPC Contracts: ui-settings-enhancement

本契约定义了 Tauri 框架下，TypeScript (前端) 与 Rust (后端) 之间的接口通信协议。本次重构的核心是将原有的单体读写拆分为 Settings 和 Apps 两个通道，并严格规范了错误返回类型。

## 1. 存储服务相关接口 (Store IPC)

### `load_settings`
读取通用的轻量级设置（如主题、列数、左右停靠）。
- **Request Payload**: 
  ```json
  { "portable": boolean }
  ```
- **Success Response**: `String` (包含 JSON 格式的 `SettingsConfig` 对象)
- **Error Response**: `String` (包含映射为字符串的 `ServiceError`，若由于文件损坏解析失败，MUST 包含 "ParseError" 关键字)

### `save_settings`
增量/独立保存通用设置。
- **Request Payload**:
  ```json
  {
    "portable": boolean,
    "settingsJson": string // 仅包含 SettingsConfig 序列化后的字符串
  }
  ```
- **Success Response**: `void`
- **Error Response**: `String`

### `load_apps` (新增)
读取重量级的应用列表。
- **Request Payload**: 
  ```json
  { "portable": boolean }
  ```
- **Success Response**: `String` (包含 JSON 格式的 `LaunchItem[]` 数组)
- **Error Response**: `String`

### `save_apps` (新增)
独立保存应用列表（高频触发）。
- **Request Payload**:
  ```json
  {
    "portable": boolean,
    "appsJson": string // 仅包含 LaunchItem[] 序列化后的字符串
  }
  ```
- **Success Response**: `void`
- **Error Response**: `String`

### `restore_from_backup` (新增)
灾难恢复接口，触发 A/B 备份的轮转替换。
- **Request Payload**:
  ```json
  { "portable": boolean }
  ```
- **Success Response**: `void`
- **Error Response**: `String`

---

## 2. 窗口控制相关接口 (Window IPC)

### `update_window_width` (新增或使用 Tauri API)
通知后端调整主窗口物理宽度。前端计算好宽度后通过该接口设置。
- **Request Payload**:
  ```json
  {
    "width": number // 精确计算后的目标像素宽度
  }
  ```
- **Success Response**: `void`
- **Error Response**: `String`
- *备注*：前端也可以直接导入 `@tauri-apps/api/window` 模块使用 `appWindow.setSize()` 方法，而无需定义专用的 Rust Command。

---

## 3. Zod 验证契约 (Frontend Schema)

前端接收到 `load_settings` 或 `load_apps` 的数据后，MUST 在进入 `useDataStore` 之前通过以下 Zod Schema 拦截并净化：

```typescript
import { z } from 'zod';

export const SettingsSchema = z.object({
  autoStart: z.boolean().default(false),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  columns: z.number().min(1).max(12).default(4),
  dockPosition: z.enum(['left', 'right']).default('right'),
  summonShortcut: z.string().default('Alt+Space'),
  summonMouseShortcut: z.string().default('Mouse4'),
  activeLeftTab: z.string().default('2'),
  leftTabs: z.array(z.any()).optional(),
  topTabs: z.record(z.array(z.any())).optional(),
}).passthrough(); // 允许未知字段，平滑兼容

export const AppItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  executablePath: z.string(),
  iconUrl: z.string().optional(),
  categoryId: z.string(),
  columnId: z.string(),
  shortcut: z.string().optional(),
  runAsAdmin: z.boolean().default(false),
});

export const AppListSchema = z.array(AppItemSchema);
```