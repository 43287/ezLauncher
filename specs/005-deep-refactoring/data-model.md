# Data Model: deep-refactoring

## 核心实体契约 (Shared Entities via ts-rs)

本项目将采用 `ts-rs` 从后端的 Rust `struct` 自动推导出前端的 TypeScript `interface`，实现单点真理 (Single Source of Truth)。

### 1. LaunchItem (应用快捷方式)
*映射前端现有的 `LaunchItem` 接口。*

```rust
#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct LaunchItem {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub item_type: String, // 'app' | 'script' | 'link' | 'command' | 'separator'
    
    // 可选字段
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(rename = "executablePath", skip_serializing_if = "Option::is_none")]
    pub executable_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(rename = "envVariables", skip_serializing_if = "Option::is_none")]
    pub env_variables: Option<String>,
    #[serde(rename = "runAsAdmin", skip_serializing_if = "Option::is_none")]
    pub run_as_admin: Option<bool>,
    #[serde(rename = "inTerminal", skip_serializing_if = "Option::is_none")]
    pub in_terminal: Option<bool>,
    #[serde(rename = "isDir", skip_serializing_if = "Option::is_none")]
    pub is_dir: Option<bool>,
    #[serde(rename = "iconUrl", skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shortcut: Option<String>,
    
    // 布局相关
    #[serde(rename = "categoryId")]
    pub category_id: String,
    #[serde(rename = "columnId")]
    pub column_id: String,
}
```

### 2. Tab / Category (分类标签)

```rust
#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct Tab {
    pub id: String,
    pub name: String,
}
```

### 3. SettingsConfig (全局配置)

```rust
#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct SettingsConfig {
    #[serde(rename = "columns")]
    pub columns: u32,
    #[serde(rename = "summonShortcut")]
    pub summon_shortcut: String,
    #[serde(rename = "summonMouseShortcut", skip_serializing_if = "Option::is_none")]
    pub summon_mouse_shortcut: Option<String>,
    #[serde(rename = "dockPosition")]
    pub dock_position: String, // 'left' | 'right'
    #[serde(rename = "leftTabs")]
    pub left_tabs: Vec<Tab>,
    #[serde(rename = "topTabs")]
    pub top_tabs: std::collections::HashMap<String, Vec<Tab>>,
}
```