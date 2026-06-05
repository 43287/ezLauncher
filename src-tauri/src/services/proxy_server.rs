use std::io::{Read, Write};
use interprocess::local_socket::{prelude::*, ListenerOptions, ToNsName, GenericNamespaced};
use std::thread;
use serde::{Deserialize, Serialize};
use super::execution_service::ExecutionService;
use std::sync::RwLock;
use rand::RngCore;

#[derive(Clone, Debug)]
pub struct ObfuscatedAuth {
    pub pid: u32,
    mask: Vec<u8>,
    encrypted_token: Vec<u8>,
}

impl ObfuscatedAuth {
    pub fn new() -> Self {
        let raw_token = uuid::Uuid::new_v4().to_string().into_bytes();
        let mut mask = vec![0u8; raw_token.len()];
        rand::thread_rng().fill_bytes(&mut mask);

        let encrypted_token = raw_token
            .iter()
            .zip(mask.iter())
            .map(|(a, b)| a ^ b)
            .collect();

        Self {
            pid: std::process::id(),
            mask,
            encrypted_token,
        }
    }

    pub fn reveal(&self) -> String {
        let decrypted: Vec<u8> = self.encrypted_token
            .iter()
            .zip(self.mask.iter())
            .map(|(a, b)| a ^ b)
            .collect();
        String::from_utf8(decrypted).unwrap_or_default()
    }
}

lazy_static::lazy_static! {
    pub static ref OBFUSCATED_AUTH: RwLock<Option<Box<ObfuscatedAuth>>> = RwLock::new(None);
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

pub fn get_or_init_auth() -> ObfuscatedAuth {
    let mut auth_lock = OBFUSCATED_AUTH.write().unwrap();
    if let Some(auth) = &*auth_lock {
        return (**auth).clone();
    }
    
    let new_auth = ObfuscatedAuth::new();
    *auth_lock = Some(Box::new(new_auth.clone()));
    new_auth
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProxyCommand {
    pub path: String,
    pub args: Option<Vec<String>>,
    // 特殊指令字段
    pub action: Option<String>,
    pub pid: Option<u32>,
    pub token: Option<String>,
}

pub const PROXY_PIPE_NAME: &str = "ezlauncher_admin_proxy.sock";

fn verify_parent_process(expected_pid: u32) -> bool {
    use sysinfo::System;
    
    let msg = format!("====> [Debug] verify_parent_process: expected_pid={}", expected_pid);
    tracing::info!("{}", msg);
    append_debug_log(&msg);

    let mut sys = System::new();
    // 仅刷新我们关心的那个 PID，避免 new_all() 的全局进程树扫描开销
    let pid = sysinfo::Pid::from_u32(expected_pid);
    sys.refresh_processes_specifics(
        sysinfo::ProcessesToUpdate::Some(&[pid]),
        sysinfo::ProcessRefreshKind::new().with_exe(sysinfo::UpdateKind::OnlyIfNotSet)
    );

    let expected_process = sys.process(pid);

    if expected_process.is_none() {
        let msg = format!("====> [Debug] verify_parent_process: Cannot find expected process (PID {}) in sysinfo! Relaxing check.", expected_pid);
        tracing::warn!("{}", msg);
        append_debug_log(&msg);
        return false;
    } else {
        let name = expected_process.unwrap().name().to_string_lossy();
        let msg = format!("====> [Debug] verify_parent_process: Found expected parent process (PID {}), name: {}", expected_pid, name);
        tracing::info!("{}", msg);
        append_debug_log(&msg);
        
        let expected_name = std::env::current_exe()
            .ok()
            .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_lowercase()))
            .unwrap_or_else(|| "app.exe".to_string());

        let target_name_str = name.to_lowercase();
        if target_name_str == expected_name || target_name_str == "ezlauncher.exe" {
            // 在精确验证通过的基础上，为了避免幽灵多开，我们可以进行一次极轻量的全局名称扫描
            // 但如果这里不再需要限制同名实例（因为单例锁已在主进程），也可以直接 return true
            return true;
        } else {
            let msg = format!("====> [Debug] verify_parent_process: Unexpected parent process name: {:?}, expected: {:?}", name, expected_name);
            tracing::error!("{}", msg);
            append_debug_log(&msg);
        }
    }
    
    false
}

pub fn run_proxy_server(expected_pid: Option<u32>, expected_token: Option<String>) {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("====> [Panic] Proxy paniced: {:?}", info);
        append_debug_log(&msg);
    }));

    let msg = format!("====> [Debug] run_proxy_server started with pid={:?}, token={:?}", expected_pid, expected_token);
    tracing::info!("{}", msg);
    append_debug_log(&msg);

    if let Some(pid) = expected_pid {
        if !verify_parent_process(pid) {
            let msg = format!("====> Proxy Server Startup Failed: Parent process verification failed for PID {}", pid);
            tracing::error!("{}", msg);
            append_debug_log(&msg);
            return;
        }
    } else {
        let msg = "====> Proxy Server Startup Failed: Expected PID not provided.";
        tracing::error!("{}", msg);
        append_debug_log(msg);
        return;
    }

    let name = match PROXY_PIPE_NAME.to_ns_name::<GenericNamespaced>() {
        Ok(n) => n,
        Err(e) => {
            let msg = format!("====> Failed to create namespace name: {}", e);
            tracing::error!("{}", msg);
            append_debug_log(&msg);
            return;
        }
    };
    let mut options = ListenerOptions::new().name(name);
    
    #[cfg(windows)]
    {
        use interprocess::os::windows::local_socket::ListenerOptionsExt;
        use interprocess::os::windows::security_descriptor::SecurityDescriptor;
        use widestring::U16CString;
        
        let sddl = "D:(A;;GA;;;BA)(A;;GA;;;AU)";
        if let Ok(sddl_u16) = U16CString::from_str(sddl) {
            if let Ok(sd) = SecurityDescriptor::deserialize(&sddl_u16) {
                options = options.security_descriptor(sd);
            } else {
                let msg = "====> Failed to deserialize SDDL for named pipe";
                tracing::error!("{}", msg);
                append_debug_log(msg);
            }
        }
    }

    let listener = match options.create_sync() {
        Ok(l) => l,
        Err(e) => {
            let msg = format!("====> Failed to bind proxy server pipe: {}", e);
            tracing::error!("{}", msg);
            append_debug_log(&msg);
            return;
        }
    };
    let msg = format!("====> Admin Proxy Server running on named pipe: {}", PROXY_PIPE_NAME);
    tracing::info!("{}", msg);
    append_debug_log(&msg);

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let msg = "====> Proxy Server connection established";
                tracing::info!("{}", msg);
                append_debug_log(msg);
                
                let token_clone = expected_token.clone();
                thread::spawn(move || {
                    handle_client(stream, expected_pid, token_clone);
                });
            }
            Err(e) => {
                let msg = format!("====> Proxy Server connection failed: {}", e);
                tracing::error!("{}", msg);
                append_debug_log(&msg);
            }
        }
    }
}

fn handle_client(mut stream: LocalSocketStream, expected_pid: Option<u32>, expected_token: Option<String>) {
    let mut buffer = [0; 4096];
    if let Ok(size) = stream.read(&mut buffer) {
        if size > 0 {
            if let Ok(command) = serde_json::from_slice::<ProxyCommand>(&buffer[..size]) {
                let msg = format!("====> Proxy received command: path={}, args={:?}, action={:?}, pid={:?}, token={:?}", 
                    command.path, command.args, command.action, command.pid, command.token);
                tracing::info!("{}", msg);
                append_debug_log(&msg);
                
                // 校验 pid 和 token
                if expected_pid.is_some() && expected_token.is_some() {
                    if command.pid != expected_pid || command.token != expected_token {
                        let msg = "====> 校验失败：无效的 pid 或 token";
                        tracing::error!("{}", msg);
                        append_debug_log(msg);
                        let _ = stream.write_all(b"ERROR: Unauthorized");
                        return;
                    }
                    let msg = "====> Proxy 校验成功";
                    tracing::info!("{}", msg);
                    append_debug_log(msg);
                }
                
                // 处理特殊指令
                if let Some(action) = command.action {
                    if action == "shutdown" {
                        let msg = "====> 收到主进程退出指令，准备结束 Proxy 进程";
                        tracing::info!("{}", msg);
                        append_debug_log(msg);
                        let _ = stream.write_all(b"OK");
                        std::process::exit(0);
                    }
                }

                let service = ExecutionService::new();
                // Admin proxy is already running as admin, so we pass false to run_as_admin
                match service.launch_app(&command.path, command.args, false) {
                    Ok(_) => {
                        let msg = "====> 执行目标程序成功";
                        tracing::info!("{}", msg);
                        append_debug_log(msg);
                        let _ = stream.write_all(b"OK");
                    }
                    Err(e) => {
                        let msg = format!("====> 执行目标程序失败: {}", e);
                        tracing::error!("{}", msg);
                        append_debug_log(&msg);
                        let _ = stream.write_all(e.as_bytes());
                    }
                }
            } else {
                let msg = "====> Proxy 收到无效的数据包";
                tracing::error!("{}", msg);
                append_debug_log(msg);
                let _ = stream.write_all(b"ERROR: Invalid payload");
            }
        }
    }
}
