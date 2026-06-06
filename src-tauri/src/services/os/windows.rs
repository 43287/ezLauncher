use std::process::Command;
use std::os::windows::process::CommandExt;
use std::time::Duration;
use std::io::{BufRead, Write};
use std::sync::Mutex;
use lazy_static::lazy_static;
use interprocess::TryClone;

use crate::services::error::ServiceError;

const DETACHED_PROCESS: u32 = 0x00000008;

lazy_static! {
    static ref PROXY_STARTING_LOCK: Mutex<()> = Mutex::new(());
}

pub fn launch_app_windows(executable_path: &str, args: Option<Vec<String>>, run_as_admin: bool) -> Result<(), ServiceError> {
    if run_as_admin {
        let send_command = || -> Result<(), ServiceError> {
            let mut guard = crate::services::proxy_server::PROXY_CONNECTION.lock().unwrap();
            if let Some(stream) = guard.as_mut() {
                let cmd = crate::services::proxy_server::ProxyCommand {
                    path: executable_path.to_string(),
                    args: args.clone(),
                    action: None,
                };
                let mut payload = serde_json::to_vec(&cmd).map_err(|e| ServiceError::Serialization(e))?;
                payload.push(b'\n');
                
                if stream.write_all(&payload).is_ok() {
                    let mut reader = std::io::BufReader::new(stream.try_clone().unwrap());
                    let mut response = String::new();
                    if reader.read_line(&mut response).is_ok() {
                        let resp_str = response.trim();
                        if resp_str == "OK" {
                            return Ok(());
                        } else {
                            return Err(ServiceError::Proxy(resp_str.to_string()));
                        }
                    }
                }
            }
            *guard = None;
            Err(ServiceError::Proxy("Not connected".to_string()))
        };

        if let Err(e) = send_command() {
            tracing::warn!("====> Proxy 未连接: {}，尝试启动 Proxy", e);
            
            let _guard = PROXY_STARTING_LOCK.lock().map_err(|e| ServiceError::Concurrency(format!("Mutex lock failed: {}", e)))?;
            
            if send_command().is_ok() {
                return Ok(());
            }

            let exe_path = std::env::current_exe()?;
            let exe_str = exe_path.to_str().ok_or_else(|| ServiceError::Internal("Failed to convert exe_path to string".to_string()))?;
            
            use windows::Win32::UI::Shell::{ShellExecuteW, SE_ERR_ACCESSDENIED};
            use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;
            use windows::core::PCWSTR;
            use widestring::U16CString;
            
            let pipe_name = crate::services::proxy_server::MAIN_PIPE_NAME.clone();
            let pid = std::process::id();
            let args_str = format!("--admin-proxy {} {}", pid, pipe_name);
            let args_u16 = U16CString::from_str(&args_str).unwrap();

            unsafe {
                let result = ShellExecuteW(
                    None,
                    PCWSTR(U16CString::from_str("runas").unwrap().as_ptr()),
                    PCWSTR(U16CString::from_str(exe_str).unwrap().as_ptr()),
                    PCWSTR(args_u16.as_ptr()),
                    None,
                    SW_HIDE,
                );

                let ret_code = result.0 as usize;
                if ret_code <= 32 {
                    if ret_code == SE_ERR_ACCESSDENIED as usize {
                        tracing::error!("====> 用户取消了 UAC 提权提示");
                        return Err(ServiceError::Security("用户取消了 UAC 提权提示".to_string()));
                    } else {
                        tracing::error!("====> ShellExecuteW 提权请求失败，代码: {}", ret_code);
                        return Err(ServiceError::Proxy(format!("ShellExecuteW failed with code {}", ret_code)));
                    }
                }
            }
        
            let mut attempts = 0;
            while attempts < 600 {
                std::thread::sleep(Duration::from_millis(100));
                if send_command().is_ok() {
                    return Ok(());
                }
                attempts += 1;
            }
            
            send_command().map_err(|e| ServiceError::Proxy(format!("Proxy 重试失败 (等待 UAC 超时或代理被系统阻止): {:?}", e)))?;
        }
        return Ok(());
    }

    if executable_path.starts_with(r"\\") {
        return Err(ServiceError::Security("Network paths starting with \\\\ are not allowed for security reasons.".to_string()));
    }

    let mut cmd = Command::new(executable_path);
    if let Some(args_vec) = args {
        cmd.args(args_vec);
    }
    
    cmd.creation_flags(DETACHED_PROCESS);
    match cmd.spawn() {
        Ok(child) => {
            tracing::info!("成功启动应用，PID: {}", child.id());
            Ok(())
        }
        Err(e) => {
            tracing::warn!("====> 作为可执行文件启动失败，回退使用 explorer: {}", e);
            let mut fallback_cmd = Command::new("explorer");
            fallback_cmd.arg(executable_path);
            fallback_cmd.creation_flags(DETACHED_PROCESS);
            match fallback_cmd.spawn() {
                Ok(child) => {
                    tracing::info!("使用 explorer 成功启动，PID: {}", child.id());
                    Ok(())
                }
                Err(e) => {
                    tracing::error!("====> 启动失败: {}", e);
                    Err(ServiceError::Launch(format!("Failed to launch application: {}", e)))
                }
            }
        }
    }
}