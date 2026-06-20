use tauri::{command, AppHandle};
use crate::application::error::AppError;

#[command]
pub fn register_shortcut(app_handle: AppHandle, shortcut: String) -> Result<(), AppError> {
    Ok(crate::services::hotkey_service::register_shortcut(&app_handle, &shortcut)?)
}

#[command]
pub fn unregister_all_shortcuts(app_handle: AppHandle) -> Result<(), AppError> {
    Ok(crate::services::hotkey_service::unregister_all_shortcuts(&app_handle)?)
}