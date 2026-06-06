use std::process::Command;
use std::os::windows::process::CommandExt;
use std::time::Duration;
use interprocess::local_socket::prelude::*;
use interprocess::local_socket::ToNsName;
use std::io::{Write, Read};
use std::sync::Mutex;
use lazy_static::lazy_static;

use crate::services::error::ServiceError;

const DETACHED_PROCESS: u32 = 0x00000008;

lazy_static! {
    static ref PROXY_STARTING_LOCK: Mutex<()> = Mutex::new(());
}

pub fn launch_app_windows(executable_path: &str, args: Option<Vec<String>>, run_as_admin: bool) -> Result<(), ServiceError> {
    if run_as_admin {
        let send_command = || -> Result<(), ServiceError> {
            let auth = crate::services::proxy_server::get_or_init_auth();
            let name = auth.pipe_name.clone().to_ns_name::<interprocess::local_socket::GenericNamespaced>().map_err(|e| ServiceError::Internal(e.to_string()))?;
            let mut stream = LocalSocketStream::connect(name)
                .map_err(|e| ServiceError::Proxy(e.to_string()))?;
                
            let token = auth.reveal();
            
            let cmd = crate::services::proxy_server::ProxyCommand {
                path: executable_path.to_string(),
                args: args.clone(),
                action: None,
                pid: Some(auth.pid),
                token: Some(token),
            };
            let payload = serde_json::to_vec(&cmd).map_err(|e| ServiceError::Serialization(e))?;
            stream.write_all(&payload)?;
            
            let mut response = [0; 1024];
            let size = stream.read(&mut response)?;
            let resp_str = String::from_utf8_lossy(&response[..size]);
            if resp_str == "OK" {
                Ok(())
            } else {
                Err(ServiceError::Proxy(resp_str.to_string()))
            }
        };

        if let Err(e) = send_command() {
            tracing::warn!("====> Proxy 连接失败: {}，尝试启动 Proxy Server", e);
            
            // 获取启动锁，如果已经被其他线程获取，则阻塞等待其完成启动过程
            let _guard = PROXY_STARTING_LOCK.lock().map_err(|e| ServiceError::Concurrency(format!("Mutex lock failed: {}", e)))?;
            
            // 拿到锁后再尝试连接一次，可能在等待锁的过程中，其他线程已经成功拉起了 Proxy
            if send_command().is_ok() {
                return Ok(());
            }

            let exe_path = std::env::current_exe()?;
            let exe_str = exe_path.to_str().ok_or_else(|| ServiceError::Internal("Failed to convert exe_path to string".to_string()))?;
            
            tracing::info!("====> 正在拉起代理进程，路径: {}", exe_str);
            
            use windows::Win32::UI::Shell::{ShellExecuteW, SE_ERR_ACCESSDENIED};
            use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;
            use windows::core::PCWSTR;
            use widestring::U16CString;
            
            let auth = crate::services::proxy_server::get_or_init_auth();
            let token = auth.reveal();
            tracing::info!("====> 自动生成 Proxy Token, PID: {} (token hidden)", auth.pid);
            
            let verb = U16CString::from_str("runas").unwrap();
            let file = U16CString::from_str(exe_str).unwrap();
            let args_str = format!("--admin-proxy {} {} {}", auth.pid, token, auth.pipe_name);
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
                        tracing::error!("====> 用户取消了 UAC 提权提示");
                        return Err(ServiceError::Security("用户取消了 UAC 提权提示".to_string()));
                    } else {
                        tracing::error!("====> ShellExecuteW 提权请求失败，代码: {}", ret_code);
                        return Err(ServiceError::Proxy(format!("ShellExecuteW failed with code {}", ret_code)));
                    }
                } else {
                    tracing::info!("====> ShellExecuteW 成功发送提权请求");
                }
            }
        
            // Wait for proxy to start, retry every 100ms up to 60 seconds (600 attempts)
            // This gives the user plenty of time to interact with the UAC prompt
            let mut attempts = 0;
            while attempts < 600 {
                std::thread::sleep(Duration::from_millis(100));
                if send_command().is_ok() {
                    return Ok(());
                }
                attempts += 1;
            }
            
            // Final Retry or fail
            // If it's a proxy error, let's also make sure we didn't just timeout reading from a successful proxy
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
            // 如果作为普通可执行文件启动失败（比如因为是普通文档或网址），则尝试使用 explorer.exe 回退
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