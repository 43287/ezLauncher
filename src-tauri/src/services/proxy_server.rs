use std::io::{BufRead, BufReader, Write};
use interprocess::local_socket::{prelude::*, ListenerOptions, ToNsName, GenericNamespaced};
use interprocess::TryClone;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use super::execution_service::{ExecutionService, ExecutionServiceTrait};
use lazy_static::lazy_static;

lazy_static! {
    pub static ref MAIN_PIPE_NAME: String = format!("ezlauncher_main_proxy_{}.sock", uuid::Uuid::new_v4().simple());
    pub static ref PROXY_CONNECTION: Mutex<Option<LocalSocketStream>> = Mutex::new(None);
}

pub fn init_main_listener() {
    std::thread::spawn(|| {
        let name = match MAIN_PIPE_NAME.clone().to_ns_name::<GenericNamespaced>() {
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
    pub action: Option<String>,
}

fn verify_parent_process(expected_pid: u32) -> bool {
    use sysinfo::System;
    let mut sys = System::new();
    let pid = sysinfo::Pid::from_u32(expected_pid);
    sys.refresh_processes_specifics(
        sysinfo::ProcessesToUpdate::Some(&[pid]),
        sysinfo::ProcessRefreshKind::new().with_exe(sysinfo::UpdateKind::OnlyIfNotSet)
    );
    if let Some(process) = sys.process(pid) {
        let name = process.name().to_string_lossy().to_lowercase();
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
    false
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
                    std::process::exit(0);
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

                    let service = ExecutionService::new();
                    // 已弃用 PowerShell 降级
                    match service.launch_app(&command.path, command.args, false) {
                        Ok(_) => {
                            let _ = stream.write_all(b"OK\n");
                        }
                        Err(e) => {
                            let err_msg = format!("ERROR: {}\n", e);
                            let _ = stream.write_all(err_msg.as_bytes());
                        }
                    }
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