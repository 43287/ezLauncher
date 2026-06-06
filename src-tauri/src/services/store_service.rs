use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::Arc;
use tauri::AppHandle;
use tauri::Manager;

use crate::services::error::ServiceError;
use crate::services::crypto_service::CryptoServiceTrait;

pub trait StoreServiceTrait: Send + Sync {
    fn get_store_path(&self, portable: bool, app_handle: &AppHandle) -> Result<String, ServiceError>;
    fn migrate_store_data(&self, to_portable: bool, app_handle: &AppHandle) -> Result<(), ServiceError>;
    fn load_settings(
        &self,
        portable: bool,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<String, ServiceError>;
    fn save_settings(
        &self,
        portable: bool,
        settings_json: String,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<(), ServiceError>;
}

pub struct StoreService;

impl StoreService {
    pub fn new() -> Self {
        Self
    }
}

impl StoreServiceTrait for StoreService {
    fn get_store_path(&self, portable: bool, app_handle: &AppHandle) -> Result<String, ServiceError> {
        if portable {
            let mut path = std::env::current_exe()?;
            path.pop(); // remove executable name
            path.push("data");
            std::fs::create_dir_all(&path)?;
            path.push("settings.json");
            Ok(path.to_string_lossy().to_string())
        } else {
            let mut path = app_handle.path().app_data_dir().map_err(|e| ServiceError::Internal(e.to_string()))?;
            std::fs::create_dir_all(&path)?;
            path.push("settings.json");
            Ok(path.to_string_lossy().to_string())
        }
    }

    fn migrate_store_data(&self, to_portable: bool, app_handle: &AppHandle) -> Result<(), ServiceError> {
        let portable_path = self.get_store_path(true, app_handle)?;
        let appdata_path = self.get_store_path(false, app_handle)?;

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

        Ok(())
    }

    fn load_settings(
        &self,
        portable: bool,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<String, ServiceError> {
        let path = self.get_store_path(portable, app_handle)?;
        if !std::path::Path::new(&path).exists() {
            return Ok("{}".to_string());
        }

        let encrypted_data = fs::read(&path)?;
        if encrypted_data.is_empty() {
            return Ok("{}".to_string());
        }

        match crypto_service.decrypt_data(&encrypted_data) {
            Ok(decrypted) => {
                String::from_utf8(decrypted).map_err(|e| ServiceError::Internal(format!("Invalid UTF-8 in settings: {}", e)))
            }
            Err(_) => {
                // 如果解密失败（可能是旧版本的明文），尝试作为明文读取
                let content = String::from_utf8(encrypted_data.clone()).unwrap_or_else(|_| "".to_string());
                // 校验是否为合法 JSON，若是则升级为密文
                if content.starts_with('{') && serde_json::from_str::<serde_json::Value>(&content).is_ok() {
                    let _ = self.save_settings(portable, content.clone(), app_handle, crypto_service);
                    Ok(content)
                } else {
                    // 解密且解析失败，创建备份，防止被覆盖
                    let mut bak_path = std::path::PathBuf::from(&path);
                    bak_path.set_extension("bak");
                    let _ = std::fs::copy(&path, &bak_path);
                    tracing::error!("Failed to decrypt settings.json and it's not a valid JSON. Backup created.");
                    Ok("{}".to_string())
                }
            }
        }
    }

    fn save_settings(
        &self,
        portable: bool,
        settings_json: String,
        app_handle: &AppHandle,
        crypto_service: Arc<dyn CryptoServiceTrait>,
    ) -> Result<(), ServiceError> {
        let path = self.get_store_path(portable, app_handle)?;
        let encrypted_data = crypto_service.encrypt_data(settings_json.as_bytes())
            .map_err(|e| ServiceError::Crypto(e.to_string()))?;

        let mut tmp_path = std::path::PathBuf::from(&path);
        tmp_path.set_extension("tmp");

        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&tmp_path)?;

        file.write_all(&encrypted_data)?;
        file.sync_all()?;

        // 原子化重命名替换，防止崩溃导致文件损坏
        std::fs::rename(&tmp_path, &path)?;

        Ok(())
    }
}
