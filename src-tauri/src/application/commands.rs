use crate::services::execution_service::ExecutionService;
use crate::services::icon_service;

#[tauri::command]
pub fn launch_app(executable_path: String) -> Result<(), String> {
    let service = ExecutionService::default();
    service.launch_app(&executable_path)
}

#[tauri::command]
pub fn extract_icon(executable_path: String) -> Result<String, String> {
    icon_service::extract_icon_base64(&executable_path)
}
