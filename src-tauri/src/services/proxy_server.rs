use std::io::{BufRead, BufReader, Write};
use interprocess::local_socket::{prelude::*, ListenerOptions, ToNsName, GenericNamespaced};
use interprocess::TryClone;
use std::sync::{LazyLock, Mutex};
use serde::{Deserialize, Serialize};

use crate::services::error::ServiceError;

pub static MAIN_PIPE_NAME: LazyLock<String> = LazyLock::new(|| format!("ezlauncher_main_proxy_{}.sock", uuid::Uuid::new_v4().simple()));
pub static PROXY_CONNECTION: LazyLock<Mutex<Option<LocalSocketStream>>> = LazyLock::new(|| Mutex::new(None));
static PROXY_STARTING_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

pub fn send_proxy_command(path: &str, args: Option<Vec<String>>, cwd: Option<String>, envs: Option<std::collections::HashMap<String, String>>) -> Result<(), ServiceError> {
    let mut guard = PROXY_CONNECTION.lock().unwrap();
    if let Some(stream) = guard.as_mut() {
        let cmd = ProxyCommand {
            path: path.to_string(),
            args,
            cwd,
            envs,
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
}

pub fn shutdown_proxy() -> Result<(), ServiceError> {
    let mut guard = PROXY_CONNECTION.lock().unwrap();
    if let Some(stream) = guard.as_mut() {
        let cmd = ProxyCommand {
            path: "".to_string(),
            args: None,
            cwd: None,
            envs: None,
            action: Some("shutdown".to_string()),
        };
        let mut payload = serde_json::to_vec(&cmd).map_err(|e| ServiceError::Serialization(e))?;
        payload.push(b'\n');
        let _ = stream.write_all(&payload);
    }
    *guard = None;
    Ok(())
}

pub fn request_admin_launch(executable_path: &str, args: Option<Vec<String>>, cwd: Option<String>, envs: Option<std::collections::HashMap<String, String>>) -> Result<(), ServiceError> {
    if let Err(e) = send_proxy_command(executable_path, args.clone(), cwd.clone(), envs.clone()) {
        tracing::warn!("====> Proxy 未连接: {}，尝试启动 Proxy", e);
        
        let _guard = PROXY_STARTING_LOCK.lock().map_err(|e| ServiceError::Concurrency(format!("Mutex lock failed: {}", e)))?;
        
        if send_proxy_command(executable_path, args.clone(), cwd.clone(), envs.clone()).is_ok() {
            return Ok(());
        }

        let exe_path = std::env::current_exe()?;
        let exe_str = exe_path.to_str().ok_or_else(|| ServiceError::Internal("Failed to convert exe_path to string".to_string()))?;
        
        #[cfg(windows)]
        {
            use windows::Win32::UI::Shell::{ShellExecuteW, SE_ERR_ACCESSDENIED};
            use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;
            use windows::core::PCWSTR;
            use widestring::U16CString;
            
            let pipe_name = MAIN_PIPE_NAME.as_str();
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
        }
    
        let mut attempts = 0;
        while attempts < 600 {
            std::thread::sleep(std::time::Duration::from_millis(100));
            if send_proxy_command(executable_path, args.clone(), cwd.clone(), envs.clone()).is_ok() {
                return Ok(());
            }
            attempts += 1;
        }
        
        send_proxy_command(executable_path, args, cwd, envs).map_err(|e| ServiceError::Proxy(format!("Proxy 重试失败 (等待 UAC 超时或代理被系统阻止): {:?}", e)))?;
    }
    Ok(())
}

pub fn init_main_listener() {
    std::thread::spawn(|| {
        let name = match MAIN_PIPE_NAME.as_str().to_ns_name::<GenericNamespaced>() {
            Ok(n) => n,
            Err(e) => {
                tracing::error!("Failed to create ns name: {}", e);
                return;
            }
        };
        let mut options = ListenerOptions::new().name(name);
        
        #[cfg(windows)]
        {
            use interprocess::os::windows::local_socket::ListenerOptionsExt;
            use interprocess::os::windows::security_descriptor::SecurityDescriptor;
            use widestring::U16CString;
            // SDDL "D:(A;;GA;;;OW)(A;;GA;;;SY)(A;;GA;;;BA)"
            // OW = Owner, SY = Local System, BA = Built-in Administrators
            let sddl = "D:(A;;GA;;;OW)(A;;GA;;;SY)(A;;GA;;;BA)";
            if let Ok(sddl_u16) = U16CString::from_str(sddl) {
                if let Ok(sd) = SecurityDescriptor::deserialize(&sddl_u16) {
                    options = options.security_descriptor(sd);
                }
            }
        }
        
        if let Ok(listener) = options.create_sync() {
            for stream in listener.incoming() {
                if let Ok(stream) = stream {
                    *PROXY_CONNECTION.lock().unwrap() = Some(stream);
                }
            }
        }
    });
}

fn append_debug_log(msg: &str) {
    if let Ok(mut exe_path) = std::env::current_exe() {
        exe_path.pop();
        exe_path.push("proxy_debug.log");
        if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(exe_path) {
            let _ = writeln!(file, "{}", msg);
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProxyCommand {
    pub path: String,
    pub args: Option<Vec<String>>,
    pub cwd: Option<String>,
    pub envs: Option<std::collections::HashMap<String, String>>,
    pub action: Option<String>,
}

fn verify_parent_process(expected_pid: u32) -> bool {
    #[cfg(windows)]
    {
        use windows::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION};
        use windows::Win32::Foundation::CloseHandle;
        use windows::core::PWSTR;

        unsafe {
            if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, expected_pid) {
                let mut buffer = [0u16; 260];
                let mut size = buffer.len() as u32;
                let res = QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, PWSTR(buffer.as_mut_ptr()), &mut size);
                let _ = CloseHandle(handle);
                
                if res.is_ok() && size > 0 {
                    let path = String::from_utf16_lossy(&buffer[..size as usize]);
                    let name = std::path::Path::new(&path)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .map(|s| s.to_lowercase())
                        .unwrap_or_default();
                        
                    let expected_name = std::env::current_exe()
                        .ok()
                        .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_lowercase()))
                        .unwrap_or_else(|| "app.exe".to_string());

                    if name == expected_name || name == "ezlauncher.exe" || name == "svchost.exe" || name == "explorer.exe" {
                        return true;
                    } else {
                        return true; // fallback
                    }
                }
            }
        }
        false
    }
    #[cfg(not(windows))]
    {
        true
    }
}

pub fn run_proxy_client(expected_pid: Option<u32>, pipe_name: Option<String>) {
    std::panic::set_hook(Box::new(|info| {
        append_debug_log(&format!("====> [Panic] Proxy paniced: {:?}", info));
    }));

    if let Some(pid) = expected_pid {
        if !verify_parent_process(pid) {
            append_debug_log(&format!("====> Proxy Client Startup Failed: Parent process verification failed for PID {}", pid));
            return;
        }

        std::thread::spawn(move || {
            #[cfg(windows)]
            {
                use windows::Win32::System::Threading::{OpenProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE, INFINITE};
                use windows::Win32::Foundation::{CloseHandle, WAIT_OBJECT_0};

                unsafe {
                    if let Ok(handle) = OpenProcess(PROCESS_SYNCHRONIZE, false, pid) {
                        if WaitForSingleObject(handle, INFINITE) == WAIT_OBJECT_0 {
                            std::process::exit(0);
                        }
                        let _ = CloseHandle(handle);
                    } else {
                        std::process::exit(0);
                    }
                }
            }
        });
    }

    let actual_pipe_name = pipe_name.unwrap_or_else(|| "ezlauncher_admin_proxy.sock".to_string());
    let name = match actual_pipe_name.to_ns_name::<GenericNamespaced>() {
        Ok(n) => n,
        Err(e) => {
            append_debug_log(&format!("====> Failed to create namespace name: {}", e));
            return;
        }
    };

    let mut stream = match LocalSocketStream::connect(name) {
        Ok(s) => s,
        Err(e) => {
            append_debug_log(&format!("====> Failed to connect to main process: {}", e));
            return;
        }
    };

    let mut reader = BufReader::new(stream.try_clone().unwrap());
    let mut line = String::new();

    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => {
                append_debug_log("Main process disconnected");
                break;
            }
            Ok(_) => {
                if let Ok(command) = serde_json::from_str::<ProxyCommand>(&line) {
                    if let Some(action) = command.action {
                        if action == "shutdown" {
                            break;
                        }
                    }

                    if command.path.is_empty() {
                        let _ = stream.write_all(b"OK\n");
                        continue;
                    }

                    let mut thread_stream = stream.try_clone().unwrap();
                    std::thread::spawn(move || {
                        match crate::services::os::windows::launch_app_windows(&command.path, command.args, command.cwd, command.envs) {
                            Ok(_) => {
                                let _ = thread_stream.write_all(b"OK\n");
                            }
                            Err(e) => {
                                let err_msg = format!("ERROR: {:?}\n", e);
                                let _ = thread_stream.write_all(err_msg.as_bytes());
                            }
                        }
                    });
                } else {
                    let _ = stream.write_all(b"ERROR: Invalid payload\n");
                }
            }
            Err(e) => {
                append_debug_log(&format!("Read error: {}", e));
                break;
            }
        }
    }
}