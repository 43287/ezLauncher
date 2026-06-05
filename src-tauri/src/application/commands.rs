use tauri::{command, AppHandle};
use crate::services::execution_service::{self, ExecutionService, ExtractedFileInfo};
use crate::services::crypto_service::CryptoService;
use std::fs::{self, OpenOptions};
use std::io::Write;
use fs2::FileExt;
use super::error::AppError;

#[command]
#[allow(unused_variables)]
pub fn get_store_path(portable: bool, app_handle: AppHandle) -> Result<String, AppError> {
    #[cfg(debug_assertions)]
    {
        // 使用 CARGO_MANIFEST_DIR 获取编译时的 src-tauri 目录，然后退回上一级得到项目根目录
        let mut path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        path.pop(); // 回退到项目根目录
        path.push("output");
        path.push("data");
        std::fs::create_dir_all(&path)?;
        path.push("settings.json");
        Ok(path.to_string_lossy().to_string())
    }
    #[cfg(not(debug_assertions))]
    {
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
pub async fn launch_app(executable_path: String, args: Option<Vec<String>>, run_as_admin: Option<bool>) -> Result<(), AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let service = ExecutionService::new();
        service.launch_app(&executable_path, args, run_as_admin.unwrap_or(false))
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
    .map_err(AppError::Execution)
}

#[command]
pub fn load_settings(portable: bool, app_handle: AppHandle) -> Result<String, AppError> {
    let path = get_store_path(portable, app_handle.clone())?;
    if !std::path::Path::new(&path).exists() {
        return Ok("{}".to_string());
    }
    
    let encrypted_data = fs::read(&path)?;
    if encrypted_data.is_empty() {
        return Ok("{}".to_string());
    }

    match CryptoService::decrypt_data(&encrypted_data) {
        Ok(decrypted) => {
            String::from_utf8(decrypted).map_err(|e| AppError::Other(format!("Invalid UTF-8 in settings: {}", e)))
        }
        Err(_) => {
            // 如果解密失败（可能是旧版本的明文），尝试作为明文读取
            let content = String::from_utf8(encrypted_data.clone()).unwrap_or_else(|_| "{}".to_string());
            // 顺便触发一次加密保存，升级为密文
            if content.starts_with('{') {
                let _ = save_settings(portable, content.clone(), app_handle);
                Ok(content)
            } else {
                Err(AppError::Crypto("Failed to decrypt settings.json and it's not a valid JSON.".to_string()))
            }
        }
    }
}

#[command]
pub fn save_settings(portable: bool, settings_json: String, app_handle: AppHandle) -> Result<(), AppError> {
    let path = get_store_path(portable, app_handle)?;
    let encrypted_data = CryptoService::encrypt_data(settings_json.as_bytes())
        .map_err(AppError::Crypto)?;
    
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(&path)?;
        
    // 加独占锁防止并发写导致文件损坏
    file.lock_exclusive()?;
    file.write_all(&encrypted_data)?;
    file.unlock()?;
    
    Ok(())
}

#[command]
pub fn extract_file_info(file_path: String) -> Result<ExtractedFileInfo, AppError> {
    execution_service::extract_file_info(file_path).map_err(AppError::Other)
}

#[command]
pub fn restart_as_admin() -> Result<(), AppError> {
    #[cfg(debug_assertions)]
    {
        return Err(AppError::Other("在开发模式下不支持以管理员身份重启，因为这会导致前端开发服务器断开连接。请在打包后使用此功能。".to_string()));
    }

    #[cfg(all(not(debug_assertions), target_os = "windows"))]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        
        let auth = crate::services::proxy_server::get_or_init_auth();
        let token = auth.reveal();
        
        tracing::info!("====> Proxy Token, PID: {}, UUID (obfuscated in memory): {}", auth.pid, token);
        
        let mut cmd = Command::new("powershell");
        cmd.arg("-NoProfile")
           .arg("-WindowStyle")
           .arg("Hidden")
           .arg("-Command")
           .arg("Start-Process")
           .arg("-FilePath")
           .arg(format!("\"{}\"", exe_path.display()))
           .arg("-ArgumentList")
           .arg(format!("\"--admin-proxy {} {}\"", auth.pid, token))
           .arg("-WindowStyle")
           .arg("Hidden")
           .arg("-Verb")
           .arg("RunAs");
           
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);

        cmd.spawn().map_err(|e| e.to_string())?;
        // 不再退出主进程
        // std::process::exit(0);
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(AppError::Other("Admin restart is only supported on Windows".to_string()))
    }
}
