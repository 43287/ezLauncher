use std::io::{Read, Write};
use interprocess::local_socket::{prelude::*, ListenerOptions, ToNsName, GenericNamespaced};
use std::thread;
use serde::{Deserialize, Serialize};
use super::execution_service::ExecutionService;

#[derive(Serialize, Deserialize, Debug)]
pub struct ProxyCommand {
    pub path: String,
    pub args: Option<Vec<String>>,
    // 特殊指令字段
    pub action: Option<String>,
}

pub const PROXY_PIPE_NAME: &str = "ezlauncher_admin_proxy.sock";

pub fn run_proxy_server() {
    let name = match PROXY_PIPE_NAME.to_ns_name::<GenericNamespaced>() {
        Ok(n) => n,
        Err(e) => {
            tracing::error!("====> Failed to create namespace name: {}", e);
            return;
        }
    };
    let mut options = ListenerOptions::new().name(name);
    
    #[cfg(windows)]
    {
        use interprocess::os::windows::local_socket::ListenerOptionsExt;
        use interprocess::os::windows::security_descriptor::SecurityDescriptor;
        use widestring::U16CString;
        
        let sddl = "D:(A;;GA;;;WD)";
        if let Ok(sddl_u16) = U16CString::from_str(sddl) {
            if let Ok(sd) = SecurityDescriptor::deserialize(&sddl_u16) {
                options = options.security_descriptor(sd);
            } else {
                tracing::error!("====> Failed to deserialize SDDL for named pipe");
            }
        }
    }

    let listener = match options.create_sync() {
        Ok(l) => l,
        Err(e) => {
            tracing::error!("====> Failed to bind proxy server pipe: {}", e);
            return;
        }
    };
    tracing::info!("====> Admin Proxy Server running on named pipe: {}", PROXY_PIPE_NAME);

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                thread::spawn(move || {
                    handle_client(stream);
                });
            }
            Err(e) => {
                tracing::error!("====> Proxy Server connection failed: {}", e);
            }
        }
    }
}

fn handle_client(mut stream: LocalSocketStream) {
    let mut buffer = [0; 4096];
    if let Ok(size) = stream.read(&mut buffer) {
        if size > 0 {
            if let Ok(command) = serde_json::from_slice::<ProxyCommand>(&buffer[..size]) {
                tracing::info!("====> Proxy received command: {:?}", command);
                
                // 处理特殊指令
                if let Some(action) = command.action {
                    if action == "shutdown" {
                        tracing::info!("====> 收到主进程退出指令，准备结束 Proxy 进程");
                        let _ = stream.write_all(b"OK");
                        std::process::exit(0);
                    }
                }

                let service = ExecutionService::new();
                // Admin proxy is already running as admin, so we pass false to run_as_admin
                match service.launch_app(&command.path, command.args, false) {
                    Ok(_) => {
                        let _ = stream.write_all(b"OK");
                    }
                    Err(e) => {
                        let _ = stream.write_all(e.as_bytes());
                    }
                }
            } else {
                let _ = stream.write_all(b"ERROR: Invalid payload");
            }
        }
    }
}
