use tauri::{command, AppHandle, State};
use crate::services::crypto_service::CryptoServiceTrait;
use crate::services::store_service::StoreServiceTrait;
use std::sync::Arc;
use crate::application::error::AppError;

#[command]
pub fn get_store_path(
    portable: bool,
    app_handle: AppHandle,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<String, AppError> {
    store_service.get_store_path(portable, &app_handle, "settings.json").map_err(|e| AppError::Other(e.to_string()))
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
pub fn load_settings(
    portable: bool, 
    app_handle: AppHandle,
    crypto_service: State<'_, Arc<dyn CryptoServiceTrait>>,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<String, AppError> {
    store_service.load_settings(portable, &app_handle, crypto_service.inner().clone()).map_err(AppError::Service)
}

#[command]
pub fn save_settings(
    portable: bool, 
    settings_json: String, 
    app_handle: AppHandle,
    crypto_service: State<'_, Arc<dyn CryptoServiceTrait>>,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<(), AppError> {
    store_service.save_settings(portable, settings_json, &app_handle, crypto_service.inner().clone()).map_err(AppError::Service)
}

#[command]
pub fn load_apps(
    portable: bool, 
    app_handle: AppHandle,
    crypto_service: State<'_, Arc<dyn CryptoServiceTrait>>,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<String, AppError> {
    store_service.load_apps(portable, &app_handle, crypto_service.inner().clone()).map_err(AppError::Service)
}

#[command]
pub fn save_apps(
    portable: bool, 
    apps_json: String, 
    app_handle: AppHandle,
    crypto_service: State<'_, Arc<dyn CryptoServiceTrait>>,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<(), AppError> {
    store_service.save_apps(portable, apps_json, &app_handle, crypto_service.inner().clone()).map_err(AppError::Service)
}

#[command]
pub fn restore_from_backup(
    portable: bool, 
    app_handle: AppHandle,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<(), AppError> {
    store_service.restore_from_backup(portable, &app_handle).map_err(AppError::Service)
}