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
                    let _ = crate::services::proxy_server::shutdown_proxy();
                }
                app.exit(0);
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let is_visible = window.is_visible().unwrap_or(false);
                    let is_focused = window.is_focused().unwrap_or(false);
                    if is_visible && is_focused {
                        crate::services::window_service::trigger_hide_animation(&window);
                    } else {
                        crate::services::window_service::trigger_show_animation(&window);
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
                        crate::services::window_service::trigger_hide_animation(&window);
                    } else {
                        crate::services::window_service::trigger_show_animation(&window);
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
