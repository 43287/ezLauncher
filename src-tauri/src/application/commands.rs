use tauri::{command, AppHandle, State};
use crate::services::execution_service::{ExecutionServiceTrait, ExtractedFileInfo};
use crate::services::crypto_service::CryptoServiceTrait;
use crate::services::store_service::StoreServiceTrait;
use std::sync::Arc;
use super::error::AppError;
use crate::services::os::windows::SystemApp;

#[command]
pub async fn get_system_apps() -> Result<Vec<SystemApp>, AppError> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::services::os::windows::scan_system_apps()
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
    .map_err(|e| AppError::Other(e.to_string()))
}

#[command]
pub fn get_store_path(
    portable: bool,
    app_handle: AppHandle,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<String, AppError> {
    store_service.get_store_path(portable, &app_handle).map_err(|e| AppError::Other(e.to_string()))
}

#[command]
pub fn migrate_store_data(
    to_portable: bool,
    app_handle: AppHandle,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<(), AppError> {
    store_service.migrate_store_data(to_portable, &app_handle).map_err(|e| AppError::Other(e.to_string()))
}

#[command]
pub async fn launch_app(
    executable_path: String, 
    args: Option<Vec<String>>, 
    run_as_admin: Option<bool>,
    cwd: Option<String>,
    envs: Option<std::collections::HashMap<String, String>>,
    execution_service: State<'_, Arc<dyn ExecutionServiceTrait>>
) -> Result<(), AppError> {
    let service = execution_service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.launch_app(&executable_path, args, run_as_admin.unwrap_or(false), cwd, envs)
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
    .map_err(|e| AppError::Execution(e.to_string()))
}

#[command]
pub fn load_settings(
    portable: bool, 
    app_handle: AppHandle,
    crypto_service: State<'_, Arc<dyn CryptoServiceTrait>>,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<String, AppError> {
    store_service.load_settings(portable, &app_handle, crypto_service.inner().clone()).map_err(|e| AppError::Other(e.to_string()))
}

#[command]
pub fn save_settings(
    portable: bool, 
    settings_json: String, 
    app_handle: AppHandle,
    crypto_service: State<'_, Arc<dyn CryptoServiceTrait>>,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<(), AppError> {
    store_service.save_settings(portable, settings_json, &app_handle, crypto_service.inner().clone()).map_err(|e| AppError::Other(e.to_string()))
}

#[command]
pub fn extract_file_info(
    file_path: String,
    execution_service: State<'_, Arc<dyn ExecutionServiceTrait>>
) -> Result<ExtractedFileInfo, AppError> {
    execution_service.extract_file_info(file_path).map_err(|e| AppError::Other(e.to_string()))
}

#[command]
pub fn register_shortcut(app_handle: AppHandle, shortcut: String) -> Result<(), AppError> {
    crate::services::hotkey_service::register_shortcut(&app_handle, &shortcut).map_err(|e| AppError::Other(e.to_string()))
}

#[command]
pub fn unregister_all_shortcuts(app_handle: AppHandle) -> Result<(), AppError> {
    crate::services::hotkey_service::unregister_all_shortcuts(&app_handle).map_err(|e| AppError::Other(e.to_string()))
}

#[command]
pub fn restart_as_admin() -> Result<(), AppError> {
    crate::services::os::windows::relaunch_as_admin().map_err(|e| AppError::Other(e.to_string()))
}
