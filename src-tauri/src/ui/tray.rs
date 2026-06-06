use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
use tauri::{App, Manager};

pub fn setup_tray(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
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
                    let auth = crate::services::proxy_server::get_or_init_auth();
                    if let Ok(name) = auth.pipe_name.clone().to_ns_name::<GenericNamespaced>() {
                        if let Ok(mut stream) = LocalSocketStream::connect(name) {
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
                }
                app.exit(0);
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let is_visible = window.is_visible().unwrap_or(false);
                    let is_focused = window.is_focused().unwrap_or(false);
                    if is_visible && is_focused {
                        crate::trigger_hide_animation(&window);
                    } else {
                        crate::trigger_show_animation(&window);
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
                        crate::trigger_hide_animation(&window);
                    } else {
                        crate::trigger_show_animation(&window);
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
