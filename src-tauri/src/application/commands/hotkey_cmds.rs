use tauri::{command, AppHandle, State};
use std::sync::Arc;
use crate::application::error::AppError;
use crate::services::hotkey_service::HotkeyServiceTrait;

#[command]
pub fn register_shortcut(
    app_handle: AppHandle,
    shortcut: String,
    hotkey_service: State<'_, Arc<dyn HotkeyServiceTrait>>
) -> Result<(), AppError> {
    Ok(hotkey_service.register_shortcut(&app_handle, &shortcut)?)
}

#[command]
pub fn unregister_all_shortcuts(
    app_handle: AppHandle,
    hotkey_service: State<'_, Arc<dyn HotkeyServiceTrait>>
) -> Result<(), AppError> {
    Ok(hotkey_service.unregister_all_shortcuts(&app_handle)?)
}
