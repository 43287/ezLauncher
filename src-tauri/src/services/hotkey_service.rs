use std::sync::{Mutex, OnceLock};
use std::thread;
use tauri::{App, AppHandle, Manager};
use rdev::{listen, Event, EventType, Key, Button};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
static REGISTERED_SHORTCUT: OnceLock<Mutex<Option<ShortcutConfig>>> = OnceLock::new();

#[derive(Clone, Debug, PartialEq)]
pub struct ShortcutConfig {
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub super_key: bool,
    pub key: Option<Key>,
    pub button: Option<Button>,
}

#[derive(Default, Debug)]
struct ModifiersState {
    ctrl: bool,
    alt: bool,
    shift: bool,
    super_key: bool,
}

pub fn setup_hotkey(app: &mut App) -> Result<(), crate::services::error::ServiceError> {
    #[cfg(desktop)]
    {
        // 存储 AppHandle 供后续调用
        let _ = APP_HANDLE.set(app.handle().clone());
        let _ = REGISTERED_SHORTCUT.set(Mutex::new(None));

        // 启动 rdev 监听线程
        thread::spawn(|| {
            let mut current_modifiers = ModifiersState::default();

            if let Err(error) = listen(move |event| {
                handle_event(&mut current_modifiers, event);
            }) {
                tracing::error!("Error in rdev listen: {:?}", error);
            }
        });
    }
    Ok(())
}

fn handle_event(modifiers: &mut ModifiersState, event: Event) {
    match event.event_type {
        EventType::KeyPress(key) => {
            update_modifiers(modifiers, key, true);
            check_trigger(modifiers, Some(key), None);
        }
        EventType::KeyRelease(key) => {
            update_modifiers(modifiers, key, false);
        }
        EventType::ButtonPress(button) => {
            check_trigger(modifiers, None, Some(button));
        }
        _ => {}
    }
}

fn update_modifiers(modifiers: &mut ModifiersState, key: Key, pressed: bool) {
    match key {
        Key::ControlLeft | Key::ControlRight => modifiers.ctrl = pressed,
        Key::Alt | Key::AltGr => modifiers.alt = pressed,
        Key::ShiftLeft | Key::ShiftRight => modifiers.shift = pressed,
        Key::MetaLeft | Key::MetaRight => modifiers.super_key = pressed,
        _ => {}
    }
}

fn check_trigger(modifiers: &ModifiersState, key: Option<Key>, button: Option<Button>) {
    if key.is_none() && button.is_none() {
        return;
    }
    
    // 忽略将修饰键本身作为主键触发
    if let Some(k) = key {
        if matches!(k, Key::ControlLeft | Key::ControlRight | Key::Alt | Key::AltGr | Key::ShiftLeft | Key::ShiftRight | Key::MetaLeft | Key::MetaRight) {
            return;
        }
    }

    let config = if let Some(lock) = REGISTERED_SHORTCUT.get() {
        if let Ok(guard) = lock.lock() {
            guard.clone()
        } else {
            return;
        }
    } else {
        return;
    };

    if let Some(cfg) = config {
        let is_match = cfg.ctrl == modifiers.ctrl
            && cfg.alt == modifiers.alt
            && cfg.shift == modifiers.shift
            && cfg.super_key == modifiers.super_key
            && cfg.key == key
            && cfg.button == button;

        if is_match {
            if let Some(app_handle) = APP_HANDLE.get() {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let is_visible = window.is_visible().unwrap_or(false);
                    let is_focused = window.is_focused().unwrap_or(false);

                    if is_visible && is_focused {
                        crate::trigger_hide_animation(&window);
                    } else {
                        crate::trigger_show_animation(&window);
                    }
                }
            }
        }
    }
}

pub fn register_shortcut(_app_handle: &AppHandle, shortcut_str: &str) -> Result<(), crate::services::error::ServiceError> {
    let config = parse_shortcut(shortcut_str)?;
    
    if let Some(lock) = REGISTERED_SHORTCUT.get() {
        if let Ok(mut guard) = lock.lock() {
            *guard = Some(config);
            tracing::info!("Registered global shortcut: {}", shortcut_str);
            return Ok(());
        }
    }
    Err(crate::services::error::ServiceError::Concurrency(
        "Failed to lock registered shortcut".to_string(),
    ))
}

pub fn unregister_all_shortcuts(_app_handle: &AppHandle) -> Result<(), crate::services::error::ServiceError> {
    if let Some(lock) = REGISTERED_SHORTCUT.get() {
        if let Ok(mut guard) = lock.lock() {
            *guard = None;
            tracing::info!("Unregistered all global shortcuts");
            return Ok(());
        }
    }
    Err(crate::services::error::ServiceError::Concurrency(
        "Failed to lock registered shortcut".to_string(),
    ))
}

pub fn parse_shortcut(shortcut_str: &str) -> Result<ShortcutConfig, crate::services::error::ServiceError> {
    let mut config = ShortcutConfig {
        ctrl: false,
        alt: false,
        shift: false,
        super_key: false,
        key: None,
        button: None,
    };

    let parts: Vec<&str> = shortcut_str.split('+').collect();
    for part in parts {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }
        match trimmed.to_uppercase().as_str() {
            "CTRL" | "CONTROL" => config.ctrl = true,
            "ALT" => config.alt = true,
            "SHIFT" => config.shift = true,
            "SUPER" | "META" => config.super_key = true,
            "MOUSE4" => config.button = Some(Button::Unknown(1)),
            "MOUSE5" => config.button = Some(Button::Unknown(2)),
            "MOUSELEFT" | "LEFTCLICK" => config.button = Some(Button::Left),
            "MOUSERIGHT" | "RIGHTCLICK" => config.button = Some(Button::Right),
            "MOUSEMIDDLE" | "MIDDLECLICK" => config.button = Some(Button::Middle),
            other => {
                if let Some(k) = map_string_to_key(other) {
                    config.key = Some(k);
                } else {
                    return Err(crate::services::error::ServiceError::Internal(format!("Unknown key or button: {}", other)));
                }
            }
        }
    }

    Ok(config)
}

fn map_string_to_key(s: &str) -> Option<Key> {
    match s.to_uppercase().as_str() {
        "A" => Some(Key::KeyA),
        "B" => Some(Key::KeyB),
        "C" => Some(Key::KeyC),
        "D" => Some(Key::KeyD),
        "E" => Some(Key::KeyE),
        "F" => Some(Key::KeyF),
        "G" => Some(Key::KeyG),
        "H" => Some(Key::KeyH),
        "I" => Some(Key::KeyI),
        "J" => Some(Key::KeyJ),
        "K" => Some(Key::KeyK),
        "L" => Some(Key::KeyL),
        "M" => Some(Key::KeyM),
        "N" => Some(Key::KeyN),
        "O" => Some(Key::KeyO),
        "P" => Some(Key::KeyP),
        "Q" => Some(Key::KeyQ),
        "R" => Some(Key::KeyR),
        "S" => Some(Key::KeyS),
        "T" => Some(Key::KeyT),
        "U" => Some(Key::KeyU),
        "V" => Some(Key::KeyV),
        "W" => Some(Key::KeyW),
        "X" => Some(Key::KeyX),
        "Y" => Some(Key::KeyY),
        "Z" => Some(Key::KeyZ),
        "0" => Some(Key::Num0),
        "1" => Some(Key::Num1),
        "2" => Some(Key::Num2),
        "3" => Some(Key::Num3),
        "4" => Some(Key::Num4),
        "5" => Some(Key::Num5),
        "6" => Some(Key::Num6),
        "7" => Some(Key::Num7),
        "8" => Some(Key::Num8),
        "9" => Some(Key::Num9),
        "SPACE" => Some(Key::Space),
        "ENTER" | "RETURN" => Some(Key::Return),
        "ESCAPE" | "ESC" => Some(Key::Escape),
        "BACKSPACE" => Some(Key::Backspace),
        "TAB" => Some(Key::Tab),
        "UP" | "ARROWUP" => Some(Key::UpArrow),
        "DOWN" | "ARROWDOWN" => Some(Key::DownArrow),
        "LEFT" | "ARROWLEFT" => Some(Key::LeftArrow),
        "RIGHT" | "ARROWRIGHT" => Some(Key::RightArrow),
        "F1" => Some(Key::F1),
        "F2" => Some(Key::F2),
        "F3" => Some(Key::F3),
        "F4" => Some(Key::F4),
        "F5" => Some(Key::F5),
        "F6" => Some(Key::F6),
        "F7" => Some(Key::F7),
        "F8" => Some(Key::F8),
        "F9" => Some(Key::F9),
        "F10" => Some(Key::F10),
        "F11" => Some(Key::F11),
        "F12" => Some(Key::F12),
        "GRAVE" | "`" | "~" => Some(Key::BackQuote),
        "MINUS" | "-" | "_" => Some(Key::Minus),
        "EQUAL" | "=" | "+" => Some(Key::Equal),
        "BRACKETLEFT" | "[" | "{" => Some(Key::LeftBracket),
        "BRACKETRIGHT" | "]" | "}" => Some(Key::RightBracket),
        "BACKSLASH" | "\\" | "|" => Some(Key::BackSlash),
        "SEMICOLON" | ";" | ":" => Some(Key::SemiColon),
        "QUOTE" | "'" | "\"" => Some(Key::Quote),
        "COMMA" | "," | "<" => Some(Key::Comma),
        "PERIOD" | "." | ">" => Some(Key::Dot),
        "SLASH" | "/" | "?" => Some(Key::Slash),
        _ => None,
    }
}
