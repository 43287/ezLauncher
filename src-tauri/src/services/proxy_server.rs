use std::io::{BufRead, BufReader, Write};
use interprocess::local_socket::{prelude::*, ListenerOptions, ToNsName, GenericNamespaced, ListenerNonblockingMode};
use interprocess::TryClone;
use std::sync::{LazyLock, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use serde::{Deserialize, Serialize};

use crate::services::error::ServiceError;

pub static MAIN_PIPE_NAME: LazyLock<String> = LazyLock::new(|| format!("ezlauncher_main_proxy_{}.sock", uuid::Uuid::new_v4().simple()));
pub static PROXY_CONNECTION: LazyLock<Mutex<Option<LocalSocketStream>>> = LazyLock::new(|| Mutex::new(None));
static PROXY_STARTING_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));
pub static SHUTDOWN_FLAG: AtomicBool = AtomicBool::new(false);

// 构造 admin proxy 启动参数串（消除 proxy_server 与 windows 模块间的重复，FR-021）
pub fn admin_proxy_args(pid: u32, pipe_name: &str) -> String {
    format!("--admin-proxy {} {}", pid, pipe_name)
}

// 代理服务的可注入抽象（DI 接缝，供 ExecutionService 注入与测试替换）。
// 说明：底层 IPC 状态（命名管道连接/PIPE 名/关闭标志）保持进程级 static——
// 它们在 run_proxy_client 子进程模式（tauri 应用初始化之前）及退出处理器中被访问，
// 无法纳入按应用实例管理的状态，故由 trait 提供接缝而非搬迁全部状态（FR-010）。
pub trait ProxyServiceTrait: Send + Sync {
    fn request_admin_launch(
        &self,
        executable_path: &str,
        args: Option<Vec<String>>,
        cwd: Option<String>,
        envs: Option<std::collections::HashMap<String, String>>,
    ) -> Result<(), ServiceError>;
    fn shutdown(&self) -> Result<(), ServiceError>;
}

pub struct ProxyService;

impl Default for ProxyService {
    fn default() -> Self {
        Self::new()
    }
}

impl ProxyService {
    pub fn new() -> Self {
        Self
    }
}

impl ProxyServiceTrait for ProxyService {
    fn request_admin_launch(
        &self,
        executable_path: &str,
        args: Option<Vec<String>>,
        cwd: Option<String>,
        envs: Option<std::collections::HashMap<String, String>>,
    ) -> Result<(), ServiceError> {
        request_admin_launch(executable_path, args, cwd, envs)
    }

    fn shutdown(&self) -> Result<(), ServiceError> {
        shutdown_proxy()
    }
}

pub fn send_proxy_command(path: &str, args: Option<Vec<String>>, cwd: Option<String>, envs: Option<std::collections::HashMap<String, String>>) -> Result<(), ServiceError> {
    // 锁中毒一致处理：恢复并记录，保留底层连接而非永久丢弃（FR-016）
    let mut guard = PROXY_CONNECTION.lock().unwrap_or_else(|p| {
        tracing::warn!("PROXY_CONNECTION mutex poisoned, recovering via into_inner()");
        p.into_inner()
    });
    if let Some(stream) = guard.as_mut() {
        let cmd = ProxyCommand {
            path: path.to_string(),
            args,
            cwd,
            envs,
            action: None,
        };
        let mut payload = serde_json::to_vec(&cmd).map_err(ServiceError::Serialization)?;
        payload.push(b'\n');

        let mut cloned_stream = stream.try_clone().map_err(ServiceError::Io)?;

        // 保持锁直到 write-read 周期完成，防止并发交错（FR-009）
        if cloned_stream.write_all(&payload).is_ok() {
            if let Ok(reader_stream) = cloned_stream.try_clone() {
                let mut reader = std::io::BufReader::new(reader_stream);
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
        return Err(ServiceError::Proxy("Failed to communicate with proxy".to_string()));
    }
    Err(ServiceError::Proxy("Not connected".to_string()))
}

pub fn shutdown_proxy() -> Result<(), ServiceError> {
    // 锁中毒一致处理：恢复并记录（FR-016）
    let mut guard = PROXY_CONNECTION.lock().unwrap_or_else(|p| {
        tracing::warn!("PROXY_CONNECTION mutex poisoned, recovering via into_inner()");
        p.into_inner()
    });
    if let Some(stream) = guard.as_mut() {
        let cmd = ProxyCommand {
            path: "".to_string(),
            args: None,
            cwd: None,
            envs: None,
            action: Some("shutdown".to_string()),
        };
        let mut payload = serde_json::to_vec(&cmd).map_err(ServiceError::Serialization)?;
        payload.push(b'\n');
        let _ = stream.write_all(&payload);
    }
    *guard = None;
    Ok(())
}

pub fn request_admin_launch(executable_path: &str, args: Option<Vec<String>>, cwd: Option<String>, envs: Option<std::collections::HashMap<String, String>>) -> Result<(), ServiceError> {
    if let Err(e) = send_proxy_command(executable_path, args.clone(), cwd.clone(), envs.clone()) {
        tracing::warn!("====> Proxy 未连接: {}，尝试启动 Proxy", e);
        
        let _guard = PROXY_STARTING_LOCK.lock().unwrap_or_else(|p| {
            tracing::warn!("PROXY_STARTING_LOCK mutex poisoned, recovering via into_inner()");
            p.into_inner()
        });
        
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
            let args_str = admin_proxy_args(pid, pipe_name);
            // 绑定到变量避免临时值过早释放（原内联 .as_ptr() 存在悬垂隐患），并以 ? 取代 unwrap 防 panic
            let args_u16 = U16CString::from_str(&args_str)
                .map_err(|e| ServiceError::Internal(format!("Invalid args string: {}", e)))?;
            let verb_u16 = U16CString::from_str("runas")
                .map_err(|e| ServiceError::Internal(format!("Invalid verb string: {}", e)))?;
            let exe_u16 = U16CString::from_str(exe_str)
                .map_err(|e| ServiceError::Internal(format!("Invalid exe path string: {}", e)))?;

            unsafe {
                let result = ShellExecuteW(
                    None,
                    PCWSTR(verb_u16.as_ptr()),
                    PCWSTR(exe_u16.as_ptr()),
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
    
        let max_attempts = 50; // 5 秒超时（原 600×100ms=60s 会阻塞调用线程过久）
        let mut attempts = 0;
        while attempts < max_attempts {
            std::thread::sleep(std::time::Duration::from_millis(100));
            if send_proxy_command(executable_path, args.clone(), cwd.clone(), envs.clone()).is_ok() {
                return Ok(());
            }
            attempts += 1;
        }

        Err(ServiceError::Proxy(
            "Admin proxy did not respond within 5 seconds — UAC may have been denied or the proxy is blocked".to_string()
        ))?;
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
        
        if let Ok(listener) = options.nonblocking(ListenerNonblockingMode::Accept).create_sync() {
            for stream in listener.incoming() {
                if SHUTDOWN_FLAG.load(Ordering::Relaxed) {
                    tracing::info!("====> Proxy listener shutting down due to shutdown flag");
                    break;
                }
                match stream {
                    Ok(s) => {
                        // 锁中毒一致处理：恢复并记录，不丢弃新接入连接（FR-016）
                        let mut guard = PROXY_CONNECTION.lock().unwrap_or_else(|p| {
                            tracing::warn!("PROXY_CONNECTION mutex poisoned, recovering via into_inner()");
                            p.into_inner()
                        });
                        *guard = Some(s);
                    }
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        std::thread::sleep(std::time::Duration::from_millis(100));
                    }
                    Err(e) => {
                        tracing::error!("Proxy listener accept error: {}", e);
                    }
                }
            }
        }
    });
}

// 提权代理为独立子进程，无 tracing 订阅者，故保留独立的文件型诊断日志（非临时插桩）。
fn append_proxy_log(msg: &str) {
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
                    let expected_path = std::env::current_exe()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default();

                    if path.eq_ignore_ascii_case(&expected_path) {
                        return true;
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
        append_proxy_log(&format!("====> [Panic] Proxy paniced: {:?}", info));
    }));

    if let Some(pid) = expected_pid {
        if !verify_parent_process(pid) {
            append_proxy_log(&format!("====> Proxy Client Startup Failed: Parent process verification failed for PID {}", pid));
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
            append_proxy_log(&format!("====> Failed to create namespace name: {}", e));
            return;
        }
    };

    let mut stream = match LocalSocketStream::connect(name) {
        Ok(s) => s,
        Err(e) => {
            append_proxy_log(&format!("====> Failed to connect to main process: {}", e));
            return;
        }
    };

    let stream_clone = match stream.try_clone() {
        Ok(s) => s,
        Err(e) => {
            append_proxy_log(&format!("====> Failed to clone stream: {}", e));
            return;
        }
    };
    let mut reader = BufReader::new(stream_clone);
    let mut line = String::new();

    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => {
                append_proxy_log("Main process disconnected");
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

                    let mut thread_stream = match stream.try_clone() {
                        Ok(s) => s,
                        Err(e) => {
                            let err_msg = format!("ERROR: Failed to clone stream: {:?}\n", e);
                            let _ = stream.write_all(err_msg.as_bytes());
                            continue;
                        }
                    };
                    std::thread::spawn(move || {
                        match crate::services::os::windows::launch_app_windows(&command.path, command.args, command.cwd, command.envs, None) {
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
                append_proxy_log(&format!("Read error: {}", e));
                break;
            }
        }
    }
}