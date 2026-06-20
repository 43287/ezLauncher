use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Instant, Duration};
use tauri::{App, AppHandle, Manager};
use rdev::{grab, Event, EventType, Key, Button};

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
static REGISTERED_SHORTCUTS: OnceLock<Mutex<Vec<ShortcutConfig>>> = OnceLock::new();
static IS_VISIBLE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
static RDEV_THREAD_STARTED: OnceLock<()> = OnceLock::new();

// 5秒超时强制重置阈值
const MODIFIER_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Clone, Debug, PartialEq)]
pub struct ShortcutConfig {
    pub ctrl: bool,
    pub alt: bool,
    pub shift: bool,
    pub super_key: bool,
    pub key: Option<Key>,
    pub button: Option<Button>,
}

#[derive(Debug)]
struct ModifiersState {
    ctrl: bool,
    alt: bool,
    shift: bool,
    super_key: bool,
    last_pressed: Option<Instant>,
}

impl Default for ModifiersState {
    fn default() -> Self {
        Self {
            ctrl: false,
            alt: false,
            shift: false,
            super_key: false,
            last_pressed: None,
        }
    }
}

impl ModifiersState {
    fn check_timeout(&mut self) {
        if let Some(time) = self.last_pressed {
            if time.elapsed() > MODIFIER_TIMEOUT {
                tracing::warn!("Modifiers stuck for over 5s, forcing reset to prevent deadlock.");
                self.ctrl = false;
                self.alt = false;
                self.shift = false;
                self.super_key = false;
                self.last_pressed = None;
            }
        }
    }

    fn update(&mut self, key: Key, pressed: bool) {
        let mut modifier_changed = false;
        match key {
            Key::ControlLeft | Key::ControlRight => { self.ctrl = pressed; modifier_changed = true; },
            Key::Alt | Key::AltGr => { self.alt = pressed; modifier_changed = true; },
            Key::ShiftLeft | Key::ShiftRight => { self.shift = pressed; modifier_changed = true; },
            Key::MetaLeft | Key::MetaRight => { self.super_key = pressed; modifier_changed = true; },
            _ => {}
        }

        if modifier_changed {
            if pressed {
                self.last_pressed = Some(Instant::now());
            } else if !self.ctrl && !self.alt && !self.shift && !self.super_key {
                self.last_pressed = None;
            }
        }
    }
}

pub fn setup_hotkey(app: &mut App) -> Result<(), crate::services::error::ServiceError> {
    #[cfg(desktop)]
    {
        // 存储 AppHandle 供后续调用
        let _ = APP_HANDLE.set(app.handle().clone());
        let _ = REGISTERED_SHORTCUTS.set(Mutex::new(Vec::new()));
    }
    Ok(())
}

fn init_rdev_thread() {
    #[cfg(desktop)]
    RDEV_THREAD_STARTED.get_or_init(|| {
        thread::spawn(|| {
            let current_modifiers = std::sync::Arc::new(std::sync::Mutex::new(ModifiersState::default()));

            if let Err(error) = grab(move |event| {
                let mut mods = current_modifiers.lock().unwrap();
                if handle_event(&mut mods, event.clone()) {
                    None // 如果匹配成功，则吞掉事件（拦截系统默认行为）
                } else {
                    Some(event) // 否则放行事件
                }
            }) {
                tracing::error!("Error in rdev grab: {:?}", error);
            }
        });
    });
}

fn handle_event(modifiers: &mut ModifiersState, event: Event) -> bool {
    // 每次处理事件前，先检查并清理可能死锁的修饰键状态
    modifiers.check_timeout();

    match event.event_type {
        EventType::KeyPress(key) => {
            modifiers.update(key, true);
            check_trigger(modifiers, Some(key), None)
        }
        EventType::KeyRelease(key) => {
            modifiers.update(key, false);
            false
        }
        EventType::ButtonPress(button) => {
            check_trigger(modifiers, None, Some(button))
        }
        _ => false,
    }
}

fn check_trigger(modifiers: &mut ModifiersState, key: Option<Key>, button: Option<Button>) -> bool {
    if key.is_none() && button.is_none() {
        return false;
    }
    
    // 忽略将修饰键本身作为主键触发
    if let Some(k) = key {
        if matches!(k, Key::ControlLeft | Key::ControlRight | Key::Alt | Key::AltGr | Key::ShiftLeft | Key::ShiftRight | Key::MetaLeft | Key::MetaRight) {
            return false;
        }
    }

    let configs = if let Some(lock) = REGISTERED_SHORTCUTS.get() {
        if let Ok(guard) = lock.lock() {
            guard.clone()
        } else {
            return false;
        }
    } else {
        return false;
    };

    for cfg in configs {
        // 由于部分符号键(如 \ 和 |)的物理按键相同，且由于输入法的干扰，
        // 在按下某些特殊字符时系统不一定会正确上报 Shift 的状态。
        // 因此针对特殊物理键匹配时，放宽对 shift 状态的强校验，或者采用前端传递的纯净修饰键配置
        let is_match = cfg.ctrl == modifiers.ctrl
            && cfg.alt == modifiers.alt
            // Windows 中 Ctrl+Shift 会触发输入法切换，底层钩子可能吃掉 Shift。
            // 因此当用户设置了 Ctrl + \ (而不带 Shift)，我们允许系统上报错误的 Shift 状态。
            // 只要目标键符合，我们就放宽 Shift 的校验
            && (cfg.shift == modifiers.shift || (key == Some(Key::BackSlash) && modifiers.shift))
            && cfg.super_key == modifiers.super_key
            && cfg.key == key
            && cfg.button == button;

        if is_match {
            // 每次成功触发后，强制重置修饰键状态
            // 这可以防止因为窗口焦点切换导致的 KeyRelease 事件丢失而引起修饰键状态卡死
            modifiers.ctrl = false;
            modifiers.alt = false;
            modifiers.shift = false;
            modifiers.super_key = false;
            modifiers.last_pressed = None;

            if let Some(app_handle) = APP_HANDLE.get() {
                if let Some(window) = app_handle.get_webview_window("main") {
                    // 我们使用 AtomicBool 来追踪可见性，完全脱离阻塞的 window 状态查询
                    let is_visible = IS_VISIBLE.load(std::sync::atomic::Ordering::SeqCst);

                    if is_visible {
                        tracing::info!("Hotkey matched: Hiding window");
                        IS_VISIBLE.store(false, std::sync::atomic::Ordering::SeqCst);
                        let win = window.clone();
                        std::thread::spawn(move || {
                            crate::trigger_hide_animation(&win);
                        });
                    } else {
                        tracing::info!("Hotkey matched: Showing window");
                        IS_VISIBLE.store(true, std::sync::atomic::Ordering::SeqCst);
                        let win = window.clone();
                        std::thread::spawn(move || {
                            crate::trigger_show_animation(&win);
                        });
                    }
                }
            }
            return true;
        }
    }
    false
}

pub fn register_shortcut(_app_handle: &AppHandle, shortcut_str: &str) -> Result<(), crate::services::error::ServiceError> {
    init_rdev_thread();

    let config = parse_shortcut(shortcut_str)?;
    
    if let Some(lock) = REGISTERED_SHORTCUTS.get() {
        if let Ok(mut guard) = lock.lock() {
            guard.push(config);
            tracing::info!("Registered global shortcut: {}", shortcut_str);
            return Ok(());
        }
    }
    Err(crate::services::error::ServiceError::Concurrency(
        "Failed to lock registered shortcut".to_string(),
    ))
}

pub fn unregister_all_shortcuts(_app_handle: &AppHandle) -> Result<(), crate::services::error::ServiceError> {
    if let Some(lock) = REGISTERED_SHORTCUTS.get() {
        if let Ok(mut guard) = lock.lock() {
            guard.clear();
            tracing::info!("Unregistered all global shortcuts");
            return Ok(());
        }
    }
    Err(crate::services::error::ServiceError::Concurrency(
        "Failed to lock registered shortcut".to_string(),
    ))
}

pub fn set_visible(visible: bool) {
    IS_VISIBLE.store(visible, std::sync::atomic::Ordering::SeqCst);
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
