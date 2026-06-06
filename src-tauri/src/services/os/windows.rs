use std::process::Command;
use std::os::windows::process::CommandExt;
use std::time::Duration;
use interprocess::local_socket::prelude::*;
use interprocess::local_socket::ToNsName;
use std::io::{Write, Read};
use std::sync::Mutex;
use lazy_static::lazy_static;

const DETACHED_PROCESS: u32 = 0x00000008;

lazy_static! {
    static ref PROXY_STARTING_LOCK: Mutex<()> = Mutex::new(());
}

pub fn launch_app_windows(executable_path: &str, args: Option<Vec<String>>, run_as_admin: bool) -> Result<(), String> {
    if run_as_admin {
        let send_command = || -> Result<(), String> {
            let name = crate::services::proxy_server::PROXY_PIPE_NAME.to_ns_name::<interprocess::local_socket::GenericNamespaced>().map_err(|e| e.to_string())?;
            let mut stream = LocalSocketStream::connect(name)
                .map_err(|e| e.to_string())?;
                
            let auth = crate::services::proxy_server::get_or_init_auth();
            let token = auth.reveal();
            
            let cmd = crate::services::proxy_server::ProxyCommand {
                path: executable_path.to_string(),
                args: args.clone(),
                action: None,
                pid: Some(auth.pid),
                token: Some(token),
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
            
            // 获取启动锁，如果已经被其他线程获取，则阻塞等待其完成启动过程
            let _guard = PROXY_STARTING_LOCK.lock().map_err(|e| format!("Mutex lock failed: {}", e))?;
            
            // 拿到锁后再尝试连接一次，可能在等待锁的过程中，其他线程已经成功拉起了 Proxy
            if send_command().is_ok() {
                return Ok(());
            }

            let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
            let exe_str = exe_path.to_str().ok_or("Failed to convert exe_path to string")?;
            
            tracing::info!("====> 正在拉起代理进程，路径: {}", exe_str);
            
            use std::process::Command;
            use std::os::windows::process::CommandExt;
            
            let auth = crate::services::proxy_server::get_or_init_auth();
            let token = auth.reveal();
            tracing::info!("====> 自动生成 Proxy Token, PID: {} (token hidden)", auth.pid);
            
            let mut cmd = Command::new("powershell");
            cmd.arg("-NoProfile")
               .arg("-WindowStyle")
               .arg("Hidden")
               .arg("-Command")
               .arg("Start-Process -FilePath $env:EZLAUNCH_EXE_PATH -ArgumentList '--admin-proxy' -WindowStyle Hidden -Verb RunAs")
               .env("EZLAUNCH_EXE_PATH", exe_str)
               .env("EZLAUNCH_PROXY_PID", auth.pid.to_string())
               .env("EZLAUNCH_PROXY_TOKEN", token);
               
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);

            match cmd.spawn() {
                Ok(_) => tracing::info!("====> PowerShell Start-Process 成功发送提权请求"),
                Err(e) => tracing::error!("====> PowerShell 提权请求失败: {}", e),
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
            send_command().map_err(|e| format!("Proxy 重试失败 (等待 UAC 超时): {}", e))?;
        }
        return Ok(());
    }

    if executable_path.starts_with(r"\\") {
        return Err("Network paths starting with \\\\ are not allowed for security reasons.".to_string());
    }

    let is_proxy = std::env::args().any(|arg| arg == "--admin-proxy");

    let mut cmd = if is_proxy {
        let mut c = Command::new(executable_path);
        if let Some(args_vec) = args {
            c.args(args_vec);
        }
        c
    } else {
        let mut c = Command::new("explorer");
        c.arg(executable_path);
        c
    };
    
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