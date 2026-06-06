use tauri::{command, AppHandle, State};
use crate::services::execution_service::{ExecutionServiceTrait, ExtractedFileInfo};
use crate::services::crypto_service::CryptoServiceTrait;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::Arc;
use super::error::AppError;

#[command]
pub fn get_store_path(portable: bool, app_handle: AppHandle) -> Result<String, AppError> {
    use tauri::Manager;
    if portable {
        let mut path = std::env::current_exe()?;
        path.pop(); // remove executable name
        path.push("data");
        std::fs::create_dir_all(&path)?;
        path.push("settings.json");
        Ok(path.to_string_lossy().to_string())
    } else {
        let mut path = app_handle.path().app_data_dir()?;
        std::fs::create_dir_all(&path)?;
        path.push("settings.json");
        Ok(path.to_string_lossy().to_string())
    }
}

#[command]
pub fn migrate_store_data(to_portable: bool, app_handle: AppHandle) -> Result<(), AppError> {
    let portable_path = get_store_path(true, app_handle.clone())?;
    let appdata_path = get_store_path(false, app_handle.clone())?;

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

#[command]
pub async fn launch_app(
    executable_path: String, 
    args: Option<Vec<String>>, 
    run_as_admin: Option<bool>,
    execution_service: State<'_, Arc<dyn ExecutionServiceTrait>>
) -> Result<(), AppError> {
    let service = execution_service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.launch_app(&executable_path, args, run_as_admin.unwrap_or(false))
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
    .map_err(|e| AppError::Execution(e.to_string()))
}

#[command]
pub fn load_settings(
    portable: bool, 
    app_handle: AppHandle,
    crypto_service: State<'_, Arc<dyn CryptoServiceTrait>>
) -> Result<String, AppError> {
    let path = get_store_path(portable, app_handle.clone())?;
    if !std::path::Path::new(&path).exists() {
        return Ok("{}".to_string());
    }
    
    let encrypted_data = fs::read(&path)?;
    if encrypted_data.is_empty() {
        return Ok("{}".to_string());
    }

    match crypto_service.decrypt_data(&encrypted_data) {
        Ok(decrypted) => {
            String::from_utf8(decrypted).map_err(|e| AppError::Other(format!("Invalid UTF-8 in settings: {}", e)))
        }
        Err(_) => {
            // 如果解密失败（可能是旧版本的明文），尝试作为明文读取
            let content = String::from_utf8(encrypted_data.clone()).unwrap_or_else(|_| "".to_string());
            // 校验是否为合法 JSON，若是则升级为密文
            if content.starts_with('{') && serde_json::from_str::<serde_json::Value>(&content).is_ok() {
                let _ = save_settings(portable, content.clone(), app_handle, crypto_service);
                Ok(content)
            } else {
                // 解密且解析失败，创建备份，防止被覆盖
                let mut bak_path = std::path::PathBuf::from(&path);
                bak_path.set_extension("bak");
                let _ = std::fs::copy(&path, &bak_path);
                Err(AppError::Crypto("Failed to decrypt settings.json and it's not a valid JSON. Backup created.".to_string()))
            }
        }
    }
}

#[command]
pub fn save_settings(
    portable: bool, 
    settings_json: String, 
    app_handle: AppHandle,
    crypto_service: State<'_, Arc<dyn CryptoServiceTrait>>
) -> Result<(), AppError> {
    let path = get_store_path(portable, app_handle)?;
    let encrypted_data = crypto_service.encrypt_data(settings_json.as_bytes())
        .map_err(AppError::Crypto)?;
    
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

#[command]
pub fn extract_file_info(
    file_path: String,
    execution_service: State<'_, Arc<dyn ExecutionServiceTrait>>
) -> Result<ExtractedFileInfo, AppError> {
    execution_service.extract_file_info(file_path).map_err(|e| AppError::Other(e.to_string()))
}

#[command]
pub fn restart_as_admin() -> Result<(), AppError> {
    #[cfg(debug_assertions)]
    {
        return Err(AppError::Other("在开发模式下不支持以管理员身份重启，因为这会导致前端开发服务器断开连接。请在打包后使用此功能。".to_string()));
    }

    #[cfg(all(not(debug_assertions), target_os = "windows"))]
    {
        use windows::Win32::UI::Shell::{ShellExecuteW, SE_ERR_ACCESSDENIED};
        use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;
        use windows::core::PCWSTR;
        use widestring::U16CString;
        use std::ptr;
        
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_str = exe_path.to_str().ok_or("Failed to convert exe_path to string")?;
        
        let pipe_name = crate::services::proxy_server::MAIN_PIPE_NAME.clone();
        let pid = std::process::id();
        
        tracing::info!("====> Requesting Admin Proxy");
        
        let verb = U16CString::from_str("runas").unwrap();
        let file = U16CString::from_str(exe_str).unwrap();
        let args_str = format!("--admin-proxy {} {}", pid, pipe_name);
        let args_u16 = U16CString::from_str(&args_str).unwrap();

        unsafe {
            let result = ShellExecuteW(
                None,
                PCWSTR(verb.as_ptr()),
                PCWSTR(file.as_ptr()),
                PCWSTR(args_u16.as_ptr()),
                None,
                SW_HIDE,
            );

            let ret_code = result.0 as usize;
            if ret_code <= 32 {
                if ret_code == SE_ERR_ACCESSDENIED as usize {
                    return Err(AppError::Other("User cancelled UAC prompt".to_string()));
                }
                return Err(AppError::Other(format!("ShellExecuteW failed with code {}", ret_code)));
            }
        }
        
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(AppError::Other("Admin restart is only supported on Windows".to_string()))
    }
}
