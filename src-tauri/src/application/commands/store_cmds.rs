use tauri::{command, AppHandle, State};
use crate::services::crypto_service::CryptoServiceTrait;
use crate::services::store_service::StoreServiceTrait;
use crate::services::portable_service::PortableServiceTrait;
use std::sync::Arc;
use crate::application::error::AppError;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreInitInfo {
    settings_exists: bool,
    apps_exists: bool,
    has_record: bool,
}

#[command]
pub fn get_portable_mode(
    portable_service: State<'_, Arc<dyn PortableServiceTrait>>
) -> Result<bool, AppError> {
    Ok(portable_service.get_portable())
}

// 切换便携开关：写注册表 → 备份目标 → 从旧位置迁移到新位置（FR-002）
#[command]
pub fn set_portable_mode(
    enabled: bool,
    app_handle: AppHandle,
    portable_service: State<'_, Arc<dyn PortableServiceTrait>>,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<(), AppError> {
    portable_service.set_portable(enabled)?;
    // migrate_store_data 内部在覆盖目标前会先备份目标，保证非破坏式
    store_service.migrate_store_data(enabled, &app_handle)?;
    Ok(())
}

// 启动后确保注册表存在便携记录（仅在缺失时写入当前默认值，不迁移），
// 使后续启动能区分“首次使用”与“疑似丢失”（FR-003）
#[command]
pub fn ensure_portable_record(
    portable_service: State<'_, Arc<dyn PortableServiceTrait>>
) -> Result<(), AppError> {
    if !portable_service.has_record() {
        let current = portable_service.get_portable();
        portable_service.set_portable(current)?;
    }
    Ok(())
}

// 启动时探测数据文件存在性与注册表记录，供前端区分“首次使用”与“疑似丢失”（FR-002a/FR-003）
#[command]
pub fn get_store_init_info(
    portable: bool,
    app_handle: AppHandle,
    portable_service: State<'_, Arc<dyn PortableServiceTrait>>,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<StoreInitInfo, AppError> {
    let (settings_exists, apps_exists) = store_service.store_files_exist(portable, &app_handle)?;
    Ok(StoreInitInfo {
        settings_exists,
        apps_exists,
        has_record: portable_service.has_record(),
    })
}

#[command]
pub fn get_store_path(
    portable: bool,
    app_handle: AppHandle,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<String, AppError> {
    Ok(store_service.get_store_path(portable, &app_handle, "settings.json")?)
}

#[command]
pub fn migrate_store_data(
    to_portable: bool,
    app_handle: AppHandle,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<(), AppError> {
    Ok(store_service.migrate_store_data(to_portable, &app_handle)?)
}

#[command]
pub async fn load_settings(
    portable: bool, 
    app_handle: AppHandle,
    crypto_service: State<'_, Arc<dyn CryptoServiceTrait>>,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<String, AppError> {
    Ok(store_service.load_settings(portable, &app_handle, crypto_service.inner().clone()).await?)
}

#[command]
pub async fn save_settings(
    portable: bool, 
    settings_json: String, 
    app_handle: AppHandle,
    crypto_service: State<'_, Arc<dyn CryptoServiceTrait>>,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<(), AppError> {
    Ok(store_service.save_settings(portable, settings_json, &app_handle, crypto_service.inner().clone()).await?)
}

#[command]
pub async fn load_apps(
    portable: bool, 
    app_handle: AppHandle,
    crypto_service: State<'_, Arc<dyn CryptoServiceTrait>>,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<String, AppError> {
    Ok(store_service.load_apps(portable, &app_handle, crypto_service.inner().clone()).await?)
}

#[command]
pub async fn save_apps(
    portable: bool, 
    apps_json: String, 
    app_handle: AppHandle,
    crypto_service: State<'_, Arc<dyn CryptoServiceTrait>>,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<(), AppError> {
    Ok(store_service.save_apps(portable, apps_json, &app_handle, crypto_service.inner().clone()).await?)
}

#[command]
pub fn restore_from_backup(
    portable: bool, 
    app_handle: AppHandle,
    store_service: State<'_, Arc<dyn StoreServiceTrait>>
) -> Result<(), AppError> {
    Ok(store_service.restore_from_backup(portable, &app_handle)?)
}