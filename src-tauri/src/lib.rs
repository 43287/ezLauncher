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
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            application::commands::launch_app,
            application::commands::extract_file_info,
            application::commands::extract_icon,
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
                    println!("====> 已尝试为管理员窗口豁免拖放相关消息 (WM_DROPFILES, WM_COPYDATA, WM_COPYGLOBALDATA)");
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
