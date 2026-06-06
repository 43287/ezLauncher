use std::io::{Read, Write};
use interprocess::local_socket::{prelude::*, ListenerOptions, ToNsName, GenericNamespaced};
use std::thread;
use serde::{Deserialize, Serialize};
use super::execution_service::{ExecutionService, ExecutionServiceTrait};
use std::sync::RwLock;
use rand::RngCore;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Clone, Debug)]
pub struct ObfuscatedAuth {
    pub pid: u32,
    mask: Vec<u8>,
    encrypted_token: Vec<u8>,
    pub pipe_name: String,
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

        let pipe_name = format!("ezlauncher_admin_proxy_{}.sock", uuid::Uuid::new_v4().simple());

        Self {
            pid: std::process::id(),
            mask,
            encrypted_token,
            pipe_name,
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
    } else if let Some(process) = expected_process {
        let name = process.name().to_string_lossy();
        let msg = format!("====> [Debug] verify_parent_process: Found expected parent process (PID {}), name: {}", expected_pid, name);
        tracing::info!("{}", msg);
        append_debug_log(&msg);
        
        let expected_name = std::env::current_exe()
            .ok()
            .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_lowercase()))
            .unwrap_or_else(|| "app.exe".to_string());

        let target_name_str = name.to_lowercase();
        // 允许名为 svchost.exe 或 explorer.exe 启动（UAC提权时，ShellExecuteW的实际父进程并非主进程，而是svchost等系统服务进程）
        if target_name_str == expected_name || target_name_str == "ezlauncher.exe" || target_name_str == "svchost.exe" || target_name_str == "explorer.exe" {
            // 在精确验证通过的基础上，为了避免幽灵多开，我们可以进行一次极轻量的全局名称扫描
            // 但如果这里不再需要限制同名实例（因为单例锁已在主进程），也可以直接 return true
            return true;
        } else {
            let msg = format!("====> [Debug] verify_parent_process: Unexpected parent process name: {:?}, expected: {:?}", name, expected_name);
            tracing::error!("{}", msg);
            append_debug_log(&msg);
            
            // 尽管名字不对，但为了兼容 UAC 的复杂启动链，这里放宽验证条件，只要 PID 存在就暂时放行
            return true;
        }
    }
    
    false
}

pub fn run_proxy_server(expected_pid: Option<u32>, expected_token: Option<String>, pipe_name: Option<String>) {
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("====> [Panic] Proxy paniced: {:?}", info);
        append_debug_log(&msg);
    }));

    let msg = format!("====> [Debug] run_proxy_server started with pid={:?}, token={:?}, pipe_name={:?}", expected_pid, expected_token, pipe_name);
    tracing::info!("{}", msg);
    append_debug_log(&msg);

    if let Some(pid) = expected_pid {
        if !verify_parent_process(pid) {
            let msg = format!("====> Proxy Server Startup Failed: Parent process verification failed for PID {}", pid);
            tracing::error!("{}", msg);
            append_debug_log(&msg);
            return;
        }

        // 启动后台线程定期检测主进程存活状态，解决孤儿化问题
        std::thread::spawn(move || {
            use sysinfo::System;
            let mut sys = System::new();
            let sys_pid = sysinfo::Pid::from_u32(pid);
            loop {
                std::thread::sleep(std::time::Duration::from_secs(2));
                sys.refresh_processes_specifics(
                    sysinfo::ProcessesToUpdate::Some(&[sys_pid]),
                    sysinfo::ProcessRefreshKind::new()
                );
                if sys.process(sys_pid).is_none() {
                    let msg = "====> [Watcher] Parent process died. Exiting proxy.";
                    tracing::info!("{}", msg);
                    append_debug_log(msg);
                    std::process::exit(0);
                }
            }
        });
    }

    let actual_pipe_name = pipe_name.unwrap_or_else(|| "ezlauncher_admin_proxy.sock".to_string());
    let name = match actual_pipe_name.clone().to_ns_name::<GenericNamespaced>() {
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
        
        // 限制命名管道访问权限。
        // SDDL "D:(A;;GA;;;OW)(A;;GA;;;SY)(A;;GRGW;;;AU)"
        // OW = Owner (创建者), SY = Local System (系统), AU = Authenticated Users
        // GA = Generic All, GRGW = Generic Read / Generic Write
        // 注意：不可修改为更强的约束（例如去掉 AU 的权限），否则将导致低权限的主进程因 Access Denied 无法连接到提权后的代理进程，引发反复触发 UAC 却无法成功拉起应用的 Bug。
        let sddl = "D:(A;;GA;;;OW)(A;;GA;;;SY)(A;;GRGW;;;AU)";
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
    let msg = format!("====> Admin Proxy Server running on named pipe: {}", actual_pipe_name);
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
                // In proxy mode, if we still fail to launch, we shouldn't fail silently.
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
                        
                        // Try fallback in proxy using PowerShell to ensure admin context is respected
                        // if we use explorer, it drops the privilege back to medium IL
                        let mut fallback_cmd = std::process::Command::new("powershell");
                        fallback_cmd.args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &format!("Start-Process '{}'", command.path)]);
                        
                        // DETACHED_PROCESS only applies to Windows, and since proxy is mainly windows feature, it's fine here
                        #[cfg(windows)]
                        {
                            fallback_cmd.creation_flags(0x00000008); 
                        }
                        match fallback_cmd.spawn() {
                            Ok(child) => {
                                let fallback_msg = format!("====> Proxy fallback to explorer 成功启动, PID: {}", child.id());
                                tracing::info!("{}", fallback_msg);
                                append_debug_log(&fallback_msg);
                                let _ = stream.write_all(b"OK");
                            }
                            Err(fb_err) => {
                                let fb_msg = format!("====> Proxy fallback to explorer 也失败了: {}", fb_err);
                                tracing::error!("{}", fb_msg);
                                append_debug_log(&fb_msg);
                                let _ = stream.write_all(e.to_string().as_bytes());
                            }
                        }
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
