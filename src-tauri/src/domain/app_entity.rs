use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppEntity {
    pub id: String,
    pub name: String,
    pub executable_path: String,
    pub shortcut: Option<String>,
}

impl AppEntity {
    pub fn new(
        id: String,
        name: String,
        executable_path: String,
        shortcut: Option<String>,
    ) -> Self {
        Self {
            id,
            name,
            executable_path,
            shortcut,
        }
    }
}
