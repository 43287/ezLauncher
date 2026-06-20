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
    
    pub category_id: String,
    pub column_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../src/types/")]
pub struct Tab {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/types/")]
pub struct SettingsConfig {
    pub columns: u32,
    pub summon_shortcut: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summon_mouse_shortcut: Option<String>,
    pub dock_position: String, // 'left' | 'right'
    pub left_tabs: Vec<Tab>,
    pub top_tabs: HashMap<String, Vec<Tab>>,
}
