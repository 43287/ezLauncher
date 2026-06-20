use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::Arc;
use tauri::AppHandle;
use tauri::Manager;

use crate::services::error::ServiceError;
use crate::services::crypto_service::CryptoServiceTrait;

use async_trait::async_trait;

#[async_trait]
pub trait StoreServiceTrait: Send + Sync {
    fn get_store_path(&self, portable: bool, app_handle: &AppHandle, file_name: &str) -> Result<String, ServiceError>;
    fn migrate_store_data(&self, to_portable: bool, app_handle: &AppHandle) -> Result<(), ServiceError>;
    
    async fn load_file(
        &self,
        portable: bool,
        file_name: &str,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<String, ServiceError>;
    
    async fn save_file(
        &self,
        portable: bool,
        file_name: &str,
        json_data: String,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<(), ServiceError>;

    async fn load_settings(
        &self,
        portable: bool,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<String, ServiceError>;
    async fn save_settings(
        &self,
        portable: bool,
        settings_json: String,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<(), ServiceError>;
    
    async fn load_apps(
        &self,
        portable: bool,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<String, ServiceError>;
    async fn save_apps(
        &self,
        portable: bool,
        apps_json: String,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<(), ServiceError>;

    fn restore_from_backup(&self, portable: bool, app_handle: &AppHandle) -> Result<(), ServiceError>;
}

pub struct StoreService;

impl Default for StoreService {
    fn default() -> Self {
        Self::new()
    }
}

impl StoreService {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl StoreServiceTrait for StoreService {
    fn get_store_path(&self, portable: bool, app_handle: &AppHandle, file_name: &str) -> Result<String, ServiceError> {
        if portable {
            let mut path = std::env::current_exe()?;
            path.pop(); // remove executable name
            path.push("data");
            std::fs::create_dir_all(&path)?;
            path.push(file_name);
            Ok(path.to_string_lossy().to_string())
        } else {
            let mut path = app_handle.path().app_data_dir().map_err(|e| ServiceError::Internal(e.to_string()))?;
            std::fs::create_dir_all(&path)?;
            path.push(file_name);
            Ok(path.to_string_lossy().to_string())
        }
    }

    fn migrate_store_data(&self, to_portable: bool, app_handle: &AppHandle) -> Result<(), ServiceError> {
        for file_name in ["settings.json", "apps.json"].iter() {
            let portable_path = self.get_store_path(true, app_handle, file_name)?;
            let appdata_path = self.get_store_path(false, app_handle, file_name)?;

            let (source, target) = if to_portable {
                (appdata_path, portable_path)
            } else {
                (portable_path, appdata_path)
            };

            let source_path = std::path::Path::new(&source);
            let target_path = std::path::Path::new(&target);

            if source_path != target_path && source_path.exists() {
                std::fs::copy(source_path, target_path)?;
            }
        }
        Ok(())
    }

    async fn load_file(
        &self,
        portable: bool,
        file_name: &str,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<String, ServiceError> {
        let path = self.get_store_path(portable, app_handle, file_name)?;
        let path_obj = std::path::Path::new(&path);
        
        if !path_obj.exists() {
            let default_val = if file_name == "apps.json" { "[]" } else { "{}" };
            return Ok(default_val.to_string());
        }

        let encrypted_data = fs::read(&path)?;
        if encrypted_data.is_empty() {
            let default_val = if file_name == "apps.json" { "[]" } else { "{}" };
            return Ok(default_val.to_string());
        }

        match crypto_service.decrypt_data(&encrypted_data) {
            Ok(decrypted) => {
                String::from_utf8(decrypted).map_err(|e| ServiceError::Parse(format!("Invalid UTF-8 in {}: {}", file_name, e)))
            }
            Err(_) => {
                // 如果解密失败（可能是旧版本的明文），尝试作为明文读取
                let content = String::from_utf8(encrypted_data.clone()).unwrap_or_else(|_| "".to_string());
                // 校验是否为合法 JSON，若是则升级为密文
                let is_valid_json = if file_name == "apps.json" {
                    content.starts_with('[') && serde_json::from_str::<serde_json::Value>(&content).is_ok()
                } else {
                    content.starts_with('{') && serde_json::from_str::<serde_json::Value>(&content).is_ok()
                };

                if is_valid_json {
                    let _ = self.save_file(portable, file_name, content.clone(), app_handle, crypto_service).await;
                    Ok(content)
                } else {
                    // 解密且解析失败，这是致命错误，返回 ParseError 阻止启动并触发恢复向导
                    tracing::error!("Failed to decrypt {} and it's not a valid JSON.", file_name);
                    Err(ServiceError::Parse(format!("Failed to decrypt and parse {}", file_name)))
                }
            }
        }
    }

    async fn save_file(
        &self,
        portable: bool,
        file_name: &str,
        json_data: String,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<(), ServiceError> {
        let path = self.get_store_path(portable, app_handle, file_name)?;
        let file_name_str = file_name.to_string();

        tauri::async_runtime::spawn_blocking(move || -> Result<(), ServiceError> {
            let encrypted_data = crypto_service.encrypt_data(json_data.as_bytes())
                .map_err(|e| ServiceError::Crypto(e.to_string()))?;

            // 1. 备份现有文件为 .bak (如果存在)
            let path_obj = std::path::PathBuf::from(&path);
            if path_obj.exists() {
                let mut bak_path = path_obj.clone();
                bak_path.set_extension("bak");
                let _ = std::fs::copy(&path_obj, &bak_path);
            }

            // 2. 写入 .tmp 文件
            let mut tmp_path = path_obj.clone();
            tmp_path.set_extension("tmp");

            let mut file = OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .open(&tmp_path)?;

            file.write_all(&encrypted_data)?;
            file.sync_all()?;

            // 3. 原子化重命名替换，防止崩溃导致文件损坏
            std::fs::rename(&tmp_path, &path_obj)?;
            
            tracing::info!("Saved {} via background thread successfully.", file_name_str);
            Ok(())
        })
        .await
        .map_err(|e| ServiceError::Internal(e.to_string()))??;

        Ok(())
    }

    async fn load_settings(
        &self,
        portable: bool,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<String, ServiceError> {
        self.load_file(portable, "settings.json", app_handle, crypto_service).await
    }

    async fn save_settings(
        &self,
        portable: bool,
        settings_json: String,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<(), ServiceError> {
        self.save_file(portable, "settings.json", settings_json, app_handle, crypto_service).await
    }
    
    async fn load_apps(
        &self,
        portable: bool,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<String, ServiceError> {
        self.load_file(portable, "apps.json", app_handle, crypto_service).await
    }

    async fn save_apps(
        &self,
        portable: bool,
        apps_json: String,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<(), ServiceError> {
        self.save_file(portable, "apps.json", apps_json, app_handle, crypto_service).await
    }

    fn restore_from_backup(&self, portable: bool, app_handle: &AppHandle) -> Result<(), ServiceError> {
        for file_name in ["settings.json", "apps.json"].iter() {
            let path = self.get_store_path(portable, app_handle, file_name)?;
            let mut bak_path = std::path::PathBuf::from(&path);
            bak_path.set_extension("bak");
            
            if bak_path.exists() {
                std::fs::copy(&bak_path, &path)?;
                tracing::info!("Restored {} from backup", file_name);
            }
        }
        Ok(())
    }
}
