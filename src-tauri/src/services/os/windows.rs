use std::process::Command;
use std::os::windows::process::CommandExt;
use std::fs;
use std::path::Path;
use std::sync::OnceLock;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};

use crate::services::error::ServiceError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemApp {
    pub name: String,
    pub path: String,
    pub icon_url: String,
}

fn system_apps_cache() -> &'static DashMap<String, Vec<SystemApp>> {
    static CACHE: OnceLock<DashMap<String, Vec<SystemApp>>> = OnceLock::new();
    CACHE.get_or_init(DashMap::new)
}

pub fn scan_system_apps() -> Result<Vec<SystemApp>, ServiceError> {
    let cache_key = "system32_apps".to_string();
    let cache = system_apps_cache();
    
    if let Some(cached) = cache.get(&cache_key) {
        return Ok(cached.clone());
    }

    let system32_dir = "C:\\Windows\\System32";
    let path = Path::new(system32_dir);
    if !path.exists() || !path.is_dir() {
        return Err(ServiceError::Internal("System32 directory not found".to_string()));
    }

    let mut apps = Vec::new();
    let entries = fs::read_dir(path).map_err(|e| ServiceError::Internal(e.to_string()))?;
    
    for entry in entries.filter_map(Result::ok) {
        let file_path = entry.path();
        if file_path.is_file() {
            if let Some(ext) = file_path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if ext_lower == "exe" || ext_lower == "msc" {
                    if let Some(name) = file_path.file_stem().and_then(|n| n.to_str()) {
                        let path_str = file_path.to_string_lossy().to_string();
                        
                        // 预解析图标以缓存
                        let _ = crate::services::icon_service::get_icon_data(&path_str);
                        
                        let icon_url = path_str.clone();
                        
                        apps.push(SystemApp {
                            name: name.to_string(),
                            path: path_str,
                            icon_url,
                        });
                    }
                }
            }
        }
    }
    
    // 按名称排序以提供一致的结果
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    cache.insert(cache_key, apps.clone());
    Ok(apps)
}

const DETACHED_PROCESS: u32 = 0x00000008;

pub fn launch_app_windows(executable_path: &str, args: Option<Vec<String>>, cwd: Option<String>, envs: Option<std::collections::HashMap<String, String>>) -> Result<(), ServiceError> {
    if executable_path.starts_with(r"\\") {
        return Err(ServiceError::Security("Network paths starting with \\\\ are not allowed for security reasons.".to_string()));
    }

    if executable_path.starts_with("http://") || executable_path.starts_with("https://") {
        match open::that(executable_path) {
            Ok(_) => {
                tracing::info!("成功通过系统默认浏览器打开 URL: {}", executable_path);
                return Ok(());
            }
            Err(e) => {
                tracing::error!("打开 URL 失败: {}", e);
                return Err(ServiceError::Launch(format!("Failed to open URL: {}", e)));
            }
        }
    }

    let path = Path::new(executable_path);
    if path.is_dir() {
        match open::that(executable_path) {
            Ok(_) => {
                tracing::info!("成功通过文件资源管理器打开文件夹: {}", executable_path);
                return Ok(());
            }
            Err(e) => {
                tracing::error!("打开文件夹失败: {}", e);
                return Err(ServiceError::Launch(format!("Failed to open directory: {}", e)));
            }
        }
    }

    let args_clone = args.clone();
    let cwd_clone = cwd.clone();

    let mut cmd = Command::new(executable_path);
    if let Some(args_vec) = args {
        cmd.args(args_vec);
    }
    if let Some(working_dir) = cwd {
        cmd.current_dir(working_dir);
    }
    if let Some(env_map) = envs {
        cmd.envs(env_map);
    }
    
    cmd.creation_flags(DETACHED_PROCESS);
    match cmd.spawn() {
        Ok(child) => {
            tracing::info!("成功启动应用，PID: {}", child.id());
            Ok(())
        }
        Err(e) => {
            tracing::warn!("====> 作为可执行文件启动失败，回退使用 ShellExecuteW: {}", e);
            use windows::Win32::UI::Shell::ShellExecuteW;
            use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
            use windows::core::PCWSTR;
            use widestring::U16CString;
            
            let file = match U16CString::from_str(executable_path) {
                Ok(s) => s,
                Err(e) => return Err(ServiceError::Launch(format!("Failed to parse executable path: {}", e))),
            };
            
            let args_u16 = if let Some(args_vec) = args_clone {
                let args_str = args_vec.join(" ");
                if args_str.is_empty() {
                    None
                } else {
                    match U16CString::from_str(&args_str) {
                        Ok(s) => Some(s),
                        Err(e) => return Err(ServiceError::Launch(e.to_string())),
                    }
                }
            } else {
                None
            };
            
            let dir_u16 = if let Some(dir) = cwd_clone {
                match U16CString::from_str(&dir) {
                    Ok(s) => Some(s),
                    Err(e) => return Err(ServiceError::Launch(e.to_string())),
                }
            } else {
                None
            };
            
            unsafe {
                let result = ShellExecuteW(
                    None,
                    None,
                    PCWSTR(file.as_ptr()),
                    args_u16.as_ref().map(|s| PCWSTR(s.as_ptr())).unwrap_or(PCWSTR(std::ptr::null())),
                    dir_u16.as_ref().map(|s| PCWSTR(s.as_ptr())).unwrap_or(PCWSTR(std::ptr::null())),
                    SW_SHOWNORMAL,
                );

                let ret_code = result.0 as usize;
                if ret_code <= 32 {
                    tracing::error!("====> ShellExecuteW 启动失败: 代码 {}", ret_code);
                    return Err(ServiceError::Launch(format!("ShellExecuteW failed with code {}", ret_code)));
                }
            }
            tracing::info!("使用 ShellExecuteW 成功启动");
            Ok(())
        }
    }
}

pub fn relaunch_as_admin() -> Result<(), ServiceError> {
    #[cfg(debug_assertions)]
    {
        return Err(ServiceError::Internal("在开发模式下不支持以管理员身份重启，因为这会导致前端开发服务器断开连接。请在打包后使用此功能。".to_string()));
    }

    #[cfg(all(not(debug_assertions), target_os = "windows"))]
    {
        use windows::Win32::UI::Shell::{ShellExecuteW, SE_ERR_ACCESSDENIED};
        use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;
        use windows::core::PCWSTR;
        use widestring::U16CString;
        
        let exe_path = std::env::current_exe().map_err(|e| ServiceError::Internal(e.to_string()))?;
        let exe_str = exe_path.to_str().ok_or_else(|| ServiceError::Internal("Failed to convert exe_path to string".to_string()))?;
        
        let pipe_name = crate::services::proxy_server::MAIN_PIPE_NAME.clone();
        let pid = std::process::id();
        
        tracing::info!("====> Requesting Admin Proxy");
        
        let verb = U16CString::from_str("runas").map_err(|e| ServiceError::Internal(e.to_string()))?;
        let file = U16CString::from_str(exe_str).map_err(|e| ServiceError::Internal(e.to_string()))?;
        let args_str = format!("--admin-proxy {} {}", pid, pipe_name);
        let args_u16 = U16CString::from_str(&args_str).map_err(|e| ServiceError::Internal(e.to_string()))?;

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
                    return Err(ServiceError::Security("User cancelled UAC prompt".to_string()));
                }
                return Err(ServiceError::Internal(format!("ShellExecuteW failed with code {}", ret_code)));
            }
        }
        
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(ServiceError::Internal("Admin restart is only supported on Windows".to_string()))
    }
}
