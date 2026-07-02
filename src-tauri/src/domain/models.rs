use serde::{Deserialize, Serialize};
use ts_rs::TS;
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/types/")]
pub struct LaunchItem {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub item_type: String, // 'app' | 'script' | 'link' | 'command' | 'separator'
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executable_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env_variables: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_as_admin: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub in_terminal: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_dir: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shortcut: Option<String>,

    // 009: 启动前的交互式输入流程（为空/缺省=沿用现状启动，行为等价）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_pipeline: Option<InputPipeline>,
    // 009: 多参数附加预设列表
    #[serde(skip_serializing_if = "Option::is_none")]
    pub param_presets: Option<Vec<ParamPreset>>,
    // 009: "多参数附加"开关（true 且 param_presets 非空才触发预设选择）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub multi_param_enabled: Option<bool>,

    pub category_id: String,
    pub column_id: String,
}

// 009: 交互式输入流程与多参数附加（contracts/data-types.md）

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/types/")]
pub struct InputPipeline {
    pub steps: Vec<CollectionStep>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/types/")]
pub struct CollectionStep {
    pub id: String,
    pub collector_type: String, // "process"|"file"|"directory"|"text"|"list"|"drop"
    pub target_placeholder: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_value: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/types/")]
pub struct ParamPreset {
    pub id: String,
    pub display_name: String,
    pub template: String,
}

// 进程选择器返回结构（contracts/tauri-commands.md C1）
#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/types/")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
    pub has_visible_window: bool,
}

// 目标拾取解析结果（contracts/tauri-commands.md C2，标签联合）
#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export, export_to = "../src/types/")]
pub enum ResolveResult {
    Process { process: ProcessInfo },
    Invalid { reason: String }, // "self" | "desktop" | "taskbar" | "unknown"
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/types/")]
pub struct Tab {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[serde(rename_all = "camelCase", default)]
#[ts(export, export_to = "../src/types/")]
pub struct SettingsConfig {
    #[serde(default = "default_columns")]
    pub columns: u32,
    #[serde(default = "default_summon_shortcut")]
    pub summon_shortcut: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summon_mouse_shortcut: Option<String>,
    #[serde(default = "default_dock_position")]
    pub dock_position: String, // 'left' | 'right'
    #[serde(default)]
    pub left_tabs: Vec<Tab>,
    #[serde(default)]
    pub top_tabs: HashMap<String, Vec<Tab>>,
    // 009: 每「item+采集器类型」保留的历史条数上限（默认 10，FR-006/Q5）
    #[serde(default = "default_history_limit")]
    pub history_limit: u32,
}

fn default_columns() -> u32 { 4 }
fn default_summon_shortcut() -> String { "Alt+Space".to_string() }
fn default_dock_position() -> String { "right".to_string() }
fn default_history_limit() -> u32 { 10 }

impl Default for SettingsConfig {
    fn default() -> Self {
        Self {
            columns: default_columns(),
            summon_shortcut: default_summon_shortcut(),
            summon_mouse_shortcut: None,
            dock_position: default_dock_position(),
            left_tabs: Vec::new(),
            top_tabs: HashMap::new(),
            history_limit: default_history_limit(),
        }
    }
}
