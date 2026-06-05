use std::process::Command;
use std::os::windows::process::CommandExt;
use std::time::Duration;
use interprocess::local_socket::prelude::*;
use interprocess::local_socket::ToNsName;
use std::io::{Write, Read};

const DETACHED_PROCESS: u32 = 0x00000008;

pub fn launch_app_windows(executable_path: &str, args: Option<Vec<String>>, run_as_admin: bool) -> Result<(), String> {
    if run_as_admin {
        let send_command = || -> Result<(), String> {
            let name = crate::services::proxy_server::PROXY_PIPE_NAME.to_ns_name::<interprocess::local_socket::GenericNamespaced>().map_err(|e| e.to_string())?;
            let mut stream = LocalSocketStream::connect(name)
                .map_err(|e| e.to_string())?;
            let cmd = crate::services::proxy_server::ProxyCommand {
                path: executable_path.to_string(),
                args: args.clone(),
                action: None,
            };
            let payload = serde_json::to_vec(&cmd).map_err(|e| e.to_string())?;
            stream.write_all(&payload).map_err(|e| e.to_string())?;
            let mut response = [0; 1024];
            let size = stream.read(&mut response).map_err(|e| e.to_string())?;
            let resp_str = String::from_utf8_lossy(&response[..size]);
            if resp_str == "OK" {
                Ok(())
            } else {
                Err(resp_str.to_string())
            }
        };

        if let Err(e) = send_command() {
            tracing::warn!("====> Proxy 连接失败: {}，尝试启动 Proxy Server", e);
            let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
            let exe_str = exe_path.to_str().unwrap();
            
            tracing::info!("====> 正在拉起代理进程，路径: {}", exe_str);
            
            use std::os::windows::ffi::OsStrExt;
            use std::ffi::OsStr;
            use windows::Win32::UI::Shell::ShellExecuteW;
            use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;
            
            let verb: Vec<u16> = OsStr::new("runas").encode_wide().chain(std::iter::once(0)).collect();
            let file: Vec<u16> = OsStr::new(exe_str).encode_wide().chain(std::iter::once(0)).collect();
            let args_w: Vec<u16> = OsStr::new("--admin-proxy").encode_wide().chain(std::iter::once(0)).collect();

            unsafe {
                let result = ShellExecuteW(
                    None,
                    windows::core::PCWSTR(verb.as_ptr()),
                    windows::core::PCWSTR(file.as_ptr()),
                    windows::core::PCWSTR(args_w.as_ptr()),
                    None,
                    SW_HIDE,
                );
                
                if result.0 as isize <= 32 {
                    tracing::error!("====> ShellExecuteW 失败，返回值: {}", result.0 as isize);
                } else {
                    tracing::info!("====> ShellExecuteW 成功发送提权请求");
                }
            }
        
            // Wait for proxy to start, retry every 100ms up to 3 seconds
            let mut attempts = 0;
            while attempts < 30 {
                std::thread::sleep(Duration::from_millis(100));
                if send_command().is_ok() {
                    return Ok(());
                }
                attempts += 1;
            }
            
            // Final Retry or fail
            send_command().map_err(|e| format!("Proxy 重试失败: {}", e))?;
        }
        return Ok(());
    }

    let (mut cmd, is_explorer) = if std::env::args().any(|arg| arg == "--admin-proxy") {
        // 如果当前进程本身就是 Proxy（已经是管理员），则直接用 cmd /c start 以继承管理员权限
        (Command::new("cmd"), false)
    } else {
        // 否则用 explorer 降权启动
        (Command::new("explorer.exe"), true)
    };

    let mut args_str = String::new();
    if let Some(args_vec) = args {
        for arg in args_vec {
            args_str.push_str(&format!(" \"{}\"", arg));
        }
    }
    
    if is_explorer {
        cmd.raw_arg(format!("\"{}\"{}", executable_path, args_str));
    } else {
        cmd.arg("/C").raw_arg(format!("start \"\" \"{}\"{}", executable_path, args_str));
    }
    
    cmd.creation_flags(DETACHED_PROCESS);
    match cmd.spawn() {
        Ok(child) => {
            tracing::info!("成功启动应用，PID: {}", child.id());
            Ok(())
        }
        Err(e) => {
            tracing::error!("====> 启动失败: {}", e);
            Err(format!("Failed to launch application: {}", e))
        }
    }
}