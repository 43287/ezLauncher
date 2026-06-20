use tauri::{command, AppHandle};
use crate::application::error::AppError;

#[command]
pub fn register_shortcut(app_handle: AppHandle, shortcut: String) -> Result<(), AppError> {
    crate::services::hotkey_service::register_shortcut(&app_handle, &shortcut).map_err(|e| AppError::Other(e.to_string()))
}

#[command]
pub fn unregister_all_shortcuts(app_handle: AppHandle) -> Result<(), AppError> {
    crate::services::hotkey_service::unregister_all_shortcuts(&app_handle).map_err(|e| AppError::Other(e.to_string()))
}