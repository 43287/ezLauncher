use tauri::Manager;
use tauri_plugin_global_shortcut::ShortcutState;

use tauri::Emitter;

pub mod domain;
pub mod services;
pub mod application;
pub mod ui;

pub fn trigger_hide_animation(window: &tauri::WebviewWindow) {
    let _ = window.emit("force_hide_animation", ());
    let win_clone = window.clone();
    std::thread::spawn(move || {
        // 等待前端 300ms 的 CSS 过渡动画完成，稍微加一点冗余时间避免闪烁
        std::thread::sleep(std::time::Duration::from_millis(350));
        let _ = win_clone.hide();
    });
}

pub fn trigger_show_animation(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus(); // 确保强制夺取焦点
    let _ = window.emit("force_show_animation", ());
}

#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) {
    trigger_hide_animation(&window);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Threading::CreateMutexW;
        use windows::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
        use widestring::U16CString;
        use windows::core::PCWSTR;
        use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_OK, MB_ICONWARNING};

        let mutex_name = U16CString::from_str("Global\\ezLauncher_SingleInstance_Mutex").unwrap();
        unsafe {
            let _mutex = CreateMutexW(None, true, PCWSTR(mutex_name.as_ptr()));
            if GetLastError() == ERROR_ALREADY_EXISTS {
                // 如果发现已经有实例在运行，并且当前启动不是作为 admin-proxy 启动（即用户双击本体），则弹窗并退出
                let args: Vec<String> = std::env::args().collect();
                if !args.contains(&"--admin-proxy".to_string()) {
                    let msg = U16CString::from_str("ezLauncher 已经在运行中。").unwrap();
                    let title = U16CString::from_str("提示").unwrap();
                    MessageBoxW(None, PCWSTR(msg.as_ptr()), PCWSTR(title.as_ptr()), MB_OK | MB_ICONWARNING);
                    std::process::exit(0);
                }
            }
        }
    }

    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()))
        .init();

    let args: Vec<String> = std::env::args().collect();
    if args.contains(&"--admin-proxy".to_string()) {
        tracing::info!("====> 启动 Admin Proxy 模式...");
        let mut expected_pid = None;
        let mut expected_token = None;
        
        if let Some(pos) = args.iter().position(|a| a == "--admin-proxy") {
            if args.len() > pos + 2 {
                expected_pid = args[pos + 1].parse::<u32>().ok();
                expected_token = Some(args[pos + 2].clone());
            } else {
                expected_pid = std::env::var("EZLAUNCH_PROXY_PID").ok().and_then(|s| s.parse::<u32>().ok());
                expected_token = std::env::var("EZLAUNCH_PROXY_TOKEN").ok();
            }
        }
        
        // 抹除环境变量，防止子进程继承
        std::env::remove_var("EZLAUNCH_PROXY_PID");
        std::env::remove_var("EZLAUNCH_PROXY_TOKEN");
        
        crate::services::proxy_server::run_proxy_server(expected_pid, expected_token);
        return;
    }

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _req, event| {
                    if event.state == ShortcutState::Pressed {
                    if let Some(window) = app.get_webview_window("main") {
                        let is_visible = window.is_visible().unwrap_or(false);
                        let is_focused = window.is_focused().unwrap_or(false);
                        
                        // 只有当窗口既可见又拥有焦点时，才收起面板；否则（被遮挡或隐藏）均唤出并置顶
                        if is_visible && is_focused {
                            trigger_hide_animation(&window);
                        } else {
                            trigger_show_animation(&window);
                        }
                    }
                }
                })
                .build(),
        );
    }

    builder
        .manage(crate::services::execution_service::ExecutionService::new())
        .register_uri_scheme_protocol("ezicon", |_app, request| {
            let uri_str = request.uri().to_string();
            tracing::info!("ezicon request: {}", uri_str);
            let path_str = request.uri().path().strip_prefix('/').unwrap_or(request.uri().path());
            let decoded_path = percent_encoding::percent_decode_str(path_str).decode_utf8_lossy().to_string();
            tracing::info!("ezicon decoded path: {}", decoded_path);
            
            let icon_data = crate::services::icon_service::get_icon_data(&decoded_path);

            tauri::http::Response::builder()
                .header("Access-Control-Allow-Origin", "*")
                .header("Content-Type", "image/png")
                .body(icon_data)
                .unwrap()
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            application::commands::launch_app,
            application::commands::extract_file_info,
            application::commands::restart_as_admin,
            application::commands::get_store_path,
            application::commands::migrate_store_data,
            application::commands::load_settings,
            application::commands::save_settings,
            hide_window
        ])
        .setup(|app| {
            let _ = crate::services::hotkey_service::setup_hotkey(app);
            let _ = crate::ui::window::setup_window(app);
            let _ = crate::ui::tray::setup_tray(app);

            Ok(())
        })
        .on_window_event(|_window, event| {
            // 当主窗口被销毁或应用退出时，清理代理进程
            if let tauri::WindowEvent::Destroyed = event {
                use interprocess::local_socket::prelude::*;
                use interprocess::local_socket::ToNsName;
                use std::io::Write;
                
                let name = match crate::services::proxy_server::PROXY_PIPE_NAME.to_ns_name::<interprocess::local_socket::GenericNamespaced>() {
                    Ok(n) => n,
                    Err(_) => return,
                };
                
                if let Ok(mut stream) = LocalSocketStream::connect(name) {
                    let auth = crate::services::proxy_server::get_or_init_auth();
                    let token = auth.reveal();
                    
                    let cmd = crate::services::proxy_server::ProxyCommand {
                        path: "".to_string(),
                        args: None,
                        action: Some("shutdown".to_string()),
                        pid: Some(auth.pid),
                        token: Some(token),
                    };
                    if let Ok(payload) = serde_json::to_vec(&cmd) {
                        let _ = stream.write_all(&payload);
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
