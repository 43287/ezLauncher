use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

use tauri::Emitter;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};

pub mod domain;
pub mod services;
pub mod application;
pub mod ui;

fn trigger_hide_animation(window: &tauri::WebviewWindow) {
    let _ = window.emit("force_hide_animation", ());
    let win_clone = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(300));
        let _ = win_clone.hide();
    });
}

fn trigger_show_animation(window: &tauri::WebviewWindow) {
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
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()))
        .init();

    let args: Vec<String> = std::env::args().collect();
    if args.contains(&"--admin-proxy".to_string()) {
        tracing::info!("====> 启动 Admin Proxy 模式...");
        crate::services::proxy_server::run_proxy_server();
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
        .register_uri_scheme_protocol("ezicon", |_app, request| {
            let uri_str = request.uri().to_string();
            tracing::info!("ezicon request: {}", uri_str);
            let path_str = request.uri().path().strip_prefix('/').unwrap_or(request.uri().path());
            let decoded_path = percent_encoding::percent_decode_str(path_str).decode_utf8_lossy().to_string();
            tracing::info!("ezicon decoded path: {}", decoded_path);
            
            let mut icon_data = vec![];
            
            #[cfg(target_os = "windows")]
            {
                if let Ok(data) = systemicons::get_icon(&decoded_path, 32) {
                    icon_data = data;
                } else {
                    tracing::warn!("Failed to extract icon for {}", decoded_path);
                }
            }

            tauri::http::Response::builder()
                .header("Access-Control-Allow-Origin", "*")
                .header("Content-Type", "image/png")
                .body(icon_data)
                .unwrap()
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            application::commands::launch_app,
            application::commands::extract_file_info,
            application::commands::restart_as_admin,
            hide_window
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::Space);
                let _ = app.global_shortcut().register(shortcut);
            }

            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let hwnd = window.hwnd().unwrap().0 as isize;
                    use windows::Win32::Foundation::HWND;
                    use windows::Win32::UI::WindowsAndMessaging::{
                        ChangeWindowMessageFilterEx, MSGFLT_ALLOW,
                    };
                    let hwnd = HWND(hwnd as *mut _);
                    const WM_DROPFILES: u32 = 0x0233;
                    const WM_COPYDATA: u32 = 0x004A;
                    const WM_COPYGLOBALDATA: u32 = 0x0049;

                    unsafe {
                        let _ = ChangeWindowMessageFilterEx(hwnd, WM_DROPFILES, MSGFLT_ALLOW, None);
                        let _ = ChangeWindowMessageFilterEx(hwnd, WM_COPYDATA, MSGFLT_ALLOW, None);
                        let _ = ChangeWindowMessageFilterEx(hwnd, WM_COPYGLOBALDATA, MSGFLT_ALLOW, None);
                    }
                    tracing::info!("====> 已尝试为管理员窗口豁免拖放相关消息 (WM_DROPFILES, WM_COPYDATA, WM_COPYGLOBALDATA)");
                }
            }

            let show_i = MenuItem::with_id(app, "show", "显示/隐藏", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        #[cfg(target_os = "windows")]
                        {
                            // 尝试向 Proxy 发送退出指令
                            use interprocess::local_socket::{prelude::*, GenericNamespaced, ToNsName};
                            use std::io::Write;
                            if let Ok(name) = crate::services::proxy_server::PROXY_PIPE_NAME.to_ns_name::<GenericNamespaced>() {
                                if let Ok(mut stream) = LocalSocketStream::connect(name) {
                                    let cmd = crate::services::proxy_server::ProxyCommand {
                                        path: "".to_string(),
                                        args: None,
                                        action: Some("shutdown".to_string()),
                                    };
                                    if let Ok(payload) = serde_json::to_vec(&cmd) {
                                        let _ = stream.write_all(&payload);
                                    }
                                }
                            }
                        }
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            let is_focused = window.is_focused().unwrap_or(false);
                            if is_visible && is_focused {
                                trigger_hide_animation(&window);
                            } else {
                                trigger_show_animation(&window);
                            }
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            let is_focused = window.is_focused().unwrap_or(false);
                            if is_visible && is_focused {
                                trigger_hide_animation(&window);
                            } else {
                                trigger_show_animation(&window);
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
