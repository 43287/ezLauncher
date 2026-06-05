use tauri::command;
use crate::services::execution_service::{self, ExecutionService, ExtractedFileInfo};
use crate::services::icon_service;

#[command]
pub fn launch_app(executable_path: String, args: Option<Vec<String>>) -> Result<(), String> {
    let service = ExecutionService::default();
    service.launch_app(&executable_path, args)
}

#[command]
pub fn extract_icon(executable_path: String) -> Result<String, String> {
    icon_service::extract_icon_base64(&executable_path)
}

#[command]
pub fn extract_file_info(file_path: String) -> Result<ExtractedFileInfo, String> {
    execution_service::extract_file_info(file_path)
}
