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

    // 返回 (settings.json 是否存在, apps.json 是否存在)，用于区分首次使用与疑似丢失
    fn store_files_exist(&self, portable: bool, app_handle: &AppHandle) -> Result<(bool, bool), ServiceError>;
}

// 根据便携标志与基目录构造数据文件路径（不触碰运行时/文件系统），便于单元测试（FR-001 / T007）。
// 便携：<exe目录>/data/<file>；非便携：<app_data_dir>/<file>。
pub(crate) fn build_store_path(
    portable: bool,
    exe_dir: &std::path::Path,
    app_data_dir: &std::path::Path,
    file_name: &str,
) -> std::path::PathBuf {
    if portable {
        exe_dir.join("data").join(file_name)
    } else {
        app_data_dir.join(file_name)
    }
}

// 从 settings.json 文本中提取 apps 数组（历史单文件格式兼容），返回序列化后的 JSON 数组字符串。
// 纯函数，便于单元测试（FR-004 / T008）。
pub(crate) fn extract_apps_from_settings(settings_str: &str) -> Option<String> {
    let val = serde_json::from_str::<serde_json::Value>(settings_str).ok()?;
    let apps = val.get("apps")?;
    if apps.is_array() {
        serde_json::to_string(apps).ok()
    } else {
        None
    }
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
        // 解析不依赖运行时的基目录，再由纯函数 build_store_path 构造完整路径（便于测试 T007）
        let path = if portable {
            let mut exe = std::env::current_exe()?;
            exe.pop(); // remove executable name -> exe 所在目录
            build_store_path(true, &exe, std::path::Path::new(""), file_name)
        } else {
            let app_data = app_handle
                .path()
                .app_data_dir()
                .map_err(|e| ServiceError::Internal(e.to_string()))?;
            build_store_path(false, std::path::Path::new(""), &app_data, file_name)
        };

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        Ok(path.to_string_lossy().to_string())
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
                // 非破坏式：覆盖目标前先备份目标已有内容（FR-002 “迁移前备份”）。
                // 备份失败则中止覆盖，避免无备份地破坏既有数据（FR-005/P2-8）。
                if target_path.exists() {
                    let mut bak_path = target_path.to_path_buf();
                    bak_path.set_extension("bak");
                    if let Err(e) = std::fs::copy(target_path, &bak_path) {
                        tracing::error!("覆盖前备份目标失败，中止迁移以防数据丢失: {}", e);
                        return Err(ServiceError::Io(e));
                    }
                }
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
                    // 不再静默把明文当密文重写存储（FR-010/P2-7）：仅兼容读取旧明文，
                    // 重新加密交由显式迁移/用户确认路径，避免构造明文被静默采纳并固化。
                    tracing::warn!(
                        "{} 解密失败但为合法明文 JSON：按旧明文读取，未自动重新加密（待显式迁移确认）。",
                        file_name
                    );
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

            // 1. 备份现有文件为 .bak (如果存在)。写入走 .tmp + rename 原子替换，
            //    故备份失败仅告警、不阻断（FR-005/P2-8）。
            let path_obj = std::path::PathBuf::from(&path);
            if path_obj.exists() {
                let mut bak_path = path_obj.clone();
                bak_path.set_extension("bak");
                if let Err(e) = std::fs::copy(&path_obj, &bak_path) {
                    tracing::warn!("写入前备份 {} 失败（继续原子写入）: {}", file_name_str, e);
                }
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
        let apps_path = self.get_store_path(portable, app_handle, "apps.json")?;
        let apps_exists = std::path::Path::new(&apps_path).exists();

        let result = self
            .load_file(portable, "apps.json", app_handle, crypto_service.clone())
            .await?;

        // 历史单文件兼容（FR-004）：独立 apps.json 不存在/为空时，
        // 尝试从 settings.json 的 apps 字段提取，并一次性迁移为独立 apps.json。
        let trimmed = result.trim();
        if !apps_exists || trimmed.is_empty() || trimmed == "[]" {
            if let Ok(settings_str) = self
                .load_file(portable, "settings.json", app_handle, crypto_service.clone())
                .await
            {
                if let Some(extracted) = extract_apps_from_settings(&settings_str) {
                    let _ = self
                        .save_file(portable, "apps.json", extracted.clone(), app_handle, crypto_service)
                        .await;
                    return Ok(extracted);
                }
            }
        }

        Ok(result)
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

    fn store_files_exist(&self, portable: bool, app_handle: &AppHandle) -> Result<(bool, bool), ServiceError> {
        let settings_path = self.get_store_path(portable, app_handle, "settings.json")?;
        let apps_path = self.get_store_path(portable, app_handle, "apps.json")?;
        let settings_exists = std::path::Path::new(&settings_path).exists();
        let apps_exists = std::path::Path::new(&apps_path).exists();
        Ok((settings_exists, apps_exists))
    }
}

#[cfg(test)]
mod tests {
    use super::{build_store_path, extract_apps_from_settings};
    use std::path::{Path, PathBuf};

    // 路径解析：便携→<exe>/data/<file>，非便携→<app_data>/<file>（FR-001 / T007）
    #[test]
    fn build_store_path_portable_uses_exe_data_dir() {
        let p = build_store_path(true, Path::new("C:\\app\\bin"), Path::new("C:\\appdata"), "settings.json");
        assert_eq!(p, PathBuf::from("C:\\app\\bin").join("data").join("settings.json"));
    }

    #[test]
    fn build_store_path_non_portable_uses_app_data_dir() {
        let p = build_store_path(false, Path::new("C:\\app\\bin"), Path::new("C:\\appdata"), "apps.json");
        assert_eq!(p, PathBuf::from("C:\\appdata").join("apps.json"));
    }

    #[test]
    fn build_store_path_differs_when_exe_moves() {
        // exe 位置变化时，便携路径随之变化（说明便携=随 exe 走）
        let a = build_store_path(true, Path::new("C:\\v1"), Path::new("C:\\appdata"), "apps.json");
        let b = build_store_path(true, Path::new("C:\\v2"), Path::new("C:\\appdata"), "apps.json");
        assert_ne!(a, b);
        // 非便携则与 exe 无关，保持稳定
        let c = build_store_path(false, Path::new("C:\\v1"), Path::new("C:\\appdata"), "apps.json");
        let d = build_store_path(false, Path::new("C:\\v2"), Path::new("C:\\appdata"), "apps.json");
        assert_eq!(c, d);
    }

    // 历史单文件格式：从 settings.json 提取 apps 数组（FR-004 / T008）
    #[test]
    fn extracts_apps_array_from_settings() {
        let settings = r#"{"leftTabs":[],"apps":[{"id":"1","name":"QQ"},{"id":"2","name":"Weixin"}],"theme":"system"}"#;
        let extracted = extract_apps_from_settings(settings).expect("应提取到 apps 数组");
        let val: serde_json::Value = serde_json::from_str(&extracted).unwrap();
        assert!(val.is_array());
        assert_eq!(val.as_array().unwrap().len(), 2);
    }

    #[test]
    fn returns_none_when_no_apps_field() {
        let settings = r#"{"leftTabs":[],"theme":"system"}"#;
        assert!(extract_apps_from_settings(settings).is_none());
    }

    #[test]
    fn returns_none_on_invalid_json() {
        assert!(extract_apps_from_settings("not json").is_none());
    }
}
