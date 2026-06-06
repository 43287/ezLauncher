use tauri::Manager;
use tauri_plugin_global_shortcut::ShortcutState;

use tauri::Emitter;

pub mod domain;
pub mod services;
pub mod application;
pub mod ui;

pub fn trigger_hide_animation(window: &tauri::WebviewWindow) {
    let _ = window.emit(crate::application::events::FORCE_HIDE_ANIMATION, ());
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
    let _ = window.emit(crate::application::events::FORCE_SHOW_ANIMATION, ());
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
        let mut expected_pipe = None;
        
        if let Some(pos) = args.iter().position(|a| a == "--admin-proxy") {
            if args.len() > pos + 2 {
                expected_pid = args[pos + 1].parse::<u32>().ok();
                expected_pipe = Some(args[pos + 2].clone());
            }
        }
        
        crate::services::proxy_server::run_proxy_client(expected_pid, expected_pipe);
        return;
    }

    crate::services::proxy_server::init_main_listener();
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
        .manage(std::sync::Arc::new(crate::services::execution_service::ExecutionService::new()) as std::sync::Arc<dyn crate::services::execution_service::ExecutionServiceTrait>)
        .manage(std::sync::Arc::new(crate::services::crypto_service::CryptoService::new()) as std::sync::Arc<dyn crate::services::crypto_service::CryptoServiceTrait>)
        .register_uri_scheme_protocol("ezicon", |_app, request| {
            let uri_str = request.uri().to_string();
            tracing::info!("ezicon request: {}", uri_str);
            let path_str = request.uri().path().strip_prefix('/').unwrap_or(request.uri().path());
            let decoded_path = percent_encoding::percent_decode_str(path_str).decode_utf8_lossy().to_string();
            tracing::info!("ezicon decoded path: {}", decoded_path);
            
            match crate::services::icon_service::get_icon_data(&decoded_path) {
                Ok(icon_data) => {
                    tauri::http::Response::builder()
                        .header("Access-Control-Allow-Origin", "*")
                        .header("Content-Type", "image/png")
                        .body(icon_data)
                        .unwrap()
                }
                Err(e) => {
                    tracing::error!("Failed to get icon data: {}", e);
                    tauri::http::Response::builder()
                        .status(400)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(e.into_bytes())
                        .unwrap()
                }
            }
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
                let mut guard = crate::services::proxy_server::PROXY_CONNECTION.lock().unwrap();
                if let Some(stream) = guard.as_mut() {
                    let cmd = crate::services::proxy_server::ProxyCommand {
                        path: "".to_string(),
                        args: None,
                        action: Some("shutdown".to_string()),
                    };
                    if let Ok(mut payload) = serde_json::to_vec(&cmd) {
                        payload.push(b'\n');
                        let _ = std::io::Write::write_all(stream, &payload);
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
