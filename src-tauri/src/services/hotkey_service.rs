use std::str::FromStr;
use tauri::{App, AppHandle};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, Modifiers, Code};

pub fn setup_hotkey(app: &mut App) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::Space);
        app.global_shortcut().register(shortcut).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub struct HotkeyService {
    app_handle: AppHandle,
}

impl HotkeyService {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    pub fn register(&self, shortcut_str: &str) -> Result<(), String> {
        let shortcut = Shortcut::from_str(shortcut_str)
            .map_err(|e| format!("Invalid shortcut {}: {}", shortcut_str, e))?;

        self.app_handle
            .global_shortcut()
            .register(shortcut)
            .map_err(|e| format!("Failed to register shortcut: {}", e))?;

        Ok(())
    }

    pub fn unregister(&self, shortcut_str: &str) -> Result<(), String> {
        let shortcut = Shortcut::from_str(shortcut_str)
            .map_err(|e| format!("Invalid shortcut {}: {}", shortcut_str, e))?;

        self.app_handle
            .global_shortcut()
            .unregister(shortcut)
            .map_err(|e| format!("Failed to unregister shortcut: {}", e))?;

        Ok(())
    }
}

pub fn parse_shortcut(shortcut_str: &str) -> Result<Shortcut, String> {
    Shortcut::from_str(shortcut_str)
        .map_err(|e| format!("Invalid shortcut {}: {}", shortcut_str, e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_shortcut() {
        let result = parse_shortcut("Ctrl+Shift+A");
        assert!(result.is_ok());
    }

    #[test]
    fn test_parse_invalid_shortcut() {
        let result = parse_shortcut("Invalid+Key+Combo");
        assert!(result.is_err());
    }
}
