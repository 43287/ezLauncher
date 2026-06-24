


use tauri::Manager;

pub mod domain;
pub mod services;
pub mod application;
pub mod ui;

#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) {
    // 也要同步更新 AtomicBool 状态，因为这是前端主动发起的隐藏（比如逃生舱或者失去焦点）
    // 经由 window_service 协调者，不在 crate 根定义动画（消除反向依赖）
    crate::services::window_service::set_visible(false);
    crate::services::window_service::trigger_hide_animation(&window);
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

        // 以 if let 取代 unwrap：字符串字面量转换理论上不会失败，万一失败也只跳过单实例守卫而非 panic
        if let Ok(mutex_name) = U16CString::from_str("Global\\ezLauncher_SingleInstance_Mutex") {
            unsafe {
                let _mutex = CreateMutexW(None, true, PCWSTR(mutex_name.as_ptr()));
                if GetLastError() == ERROR_ALREADY_EXISTS {
                    // 如果发现已经有实例在运行，并且当前启动不是作为 admin-proxy 启动（即用户双击本体），则弹窗并退出
                    let args: Vec<String> = std::env::args().collect();
                    if !args.contains(&"--admin-proxy".to_string()) {
                        if let (Ok(msg), Ok(title)) = (
                            U16CString::from_str("ezLauncher 已经在运行中。"),
                            U16CString::from_str("提示"),
                        ) {
                            MessageBoxW(None, PCWSTR(msg.as_ptr()), PCWSTR(title.as_ptr()), MB_OK | MB_ICONWARNING);
                        }
                        std::process::exit(0);
                    }
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

    // 统一依赖装配：所有服务以一致方式构造为 Arc<dyn _> 注入（FR-010）。
    // ExecutionService 经构造函数注入 ProxyService（服务间依赖经抽象）。
    let proxy_service: std::sync::Arc<dyn crate::services::proxy_server::ProxyServiceTrait> =
        std::sync::Arc::new(crate::services::proxy_server::ProxyService::new());
    let execution_service: std::sync::Arc<dyn crate::services::execution_service::ExecutionServiceTrait> =
        std::sync::Arc::new(crate::services::execution_service::ExecutionService::new(proxy_service.clone()));
    let icon_service: std::sync::Arc<dyn crate::services::icon_service::IconServiceTrait> =
        std::sync::Arc::new(crate::services::icon_service::IconService::new());

    let builder = tauri::Builder::default();

    builder
        .manage(execution_service)
        .manage(proxy_service)
        .manage(icon_service)
        .manage(std::sync::Arc::new(crate::services::crypto_service::CryptoService::new()) as std::sync::Arc<dyn crate::services::crypto_service::CryptoServiceTrait>)
        .manage(std::sync::Arc::new(crate::services::store_service::StoreService::new()) as std::sync::Arc<dyn crate::services::store_service::StoreServiceTrait>)
        .manage(std::sync::Arc::new(crate::services::portable_service::PortableService::new()) as std::sync::Arc<dyn crate::services::portable_service::PortableServiceTrait>)
        .manage(std::sync::Arc::new(crate::services::hotkey_service::HotkeyService::new()) as std::sync::Arc<dyn crate::services::hotkey_service::HotkeyServiceTrait>)
        .register_asynchronous_uri_scheme_protocol("ezicon", |app, request, responder| {
            let uri_str = request.uri().to_string();
            tracing::info!("ezicon request: {}", uri_str);
            let path_str = request.uri().path().strip_prefix('/').unwrap_or(request.uri().path());
            let decoded_path = percent_encoding::percent_decode_str(path_str).decode_utf8_lossy().to_string();
            tracing::info!("ezicon decoded path: {}", decoded_path);

            // 从托管状态解析图标服务（经实例缓存），不再调用自由函数
            let icon_service = app
                .app_handle()
                .state::<std::sync::Arc<dyn crate::services::icon_service::IconServiceTrait>>()
                .inner()
                .clone();

            tauri::async_runtime::spawn(async move {
                match icon_service.get_icon_data(&decoded_path).await {
                    Ok(icon_data) => {
                        match tauri::http::Response::builder()
                            .header("Content-Type", "image/png")
                            .body(icon_data)
                        {
                            Ok(response) => responder.respond(response),
                            Err(e) => {
                                tracing::error!("Failed to build icon response: {:?}", e);
                                let fallback = tauri::http::Response::builder()
                                    .status(500)
                                    .body(Vec::new())
                                    .unwrap_or_default();
                                responder.respond(fallback);
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to get icon data: {:?}", e);
                        let response = tauri::http::Response::builder()
                            .status(400)
                            .body(e.to_string().into_bytes())
                            .unwrap_or_default();
                        responder.respond(response);
                    }
                }
            });
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec![])))
        .invoke_handler(tauri::generate_handler![
            application::commands::app_cmds::launch_app,
            application::commands::app_cmds::extract_file_info,
            application::commands::app_cmds::restart_as_admin,
            application::commands::app_cmds::get_system_apps,
            application::commands::app_cmds::update_window_width,
            application::commands::store_cmds::get_store_path,
            application::commands::store_cmds::migrate_store_data,
            application::commands::store_cmds::load_settings,
            application::commands::store_cmds::save_settings,
            application::commands::store_cmds::load_apps,
            application::commands::store_cmds::save_apps,
            application::commands::store_cmds::restore_from_backup,
            application::commands::store_cmds::get_portable_mode,
            application::commands::store_cmds::set_portable_mode,
            application::commands::store_cmds::get_store_init_info,
            application::commands::store_cmds::ensure_portable_record,
            application::commands::store_cmds::load_history,
            application::commands::store_cmds::save_history,
            application::commands::store_cmds::clear_history,
            application::commands::collector_cmds::enumerate_processes,
            application::commands::collector_cmds::resolve_window_process_at_cursor,
            application::commands::hotkey_cmds::register_shortcut,
            application::commands::hotkey_cmds::unregister_all_shortcuts,
            crate::services::icon_service::copy_custom_icon,
            hide_window
        ])
        .setup(|app| {
            // 初始化子系统失败应记录而非静默吞掉（FR-003/P2-8）；单项失败不阻断启动
            if let Err(e) = crate::services::hotkey_service::setup_hotkey(app) {
                tracing::error!("====> setup_hotkey 失败: {:?}", e);
            }
            if let Err(e) = crate::ui::window::setup_window(app) {
                tracing::error!("====> setup_window 失败: {:?}", e);
            }
            if let Err(e) = crate::ui::tray::setup_tray(app) {
                tracing::error!("====> setup_tray 失败: {:?}", e);
            }

            Ok(())
        })
        .on_window_event(|_window, event| {
            // 当主窗口被销毁或应用退出时，清理代理进程
            if let tauri::WindowEvent::Destroyed = event {
                crate::services::proxy_server::SHUTDOWN_FLAG.store(true, std::sync::atomic::Ordering::Relaxed);
                let _ = crate::services::proxy_server::shutdown_proxy();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                crate::services::proxy_server::SHUTDOWN_FLAG.store(true, std::sync::atomic::Ordering::Relaxed);
                let _ = crate::services::proxy_server::shutdown_proxy();
            }
        });
}

