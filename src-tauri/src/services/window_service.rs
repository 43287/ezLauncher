// 窗口可见性与显隐动画的协调者。
// 作为单一所有者持有 IS_VISIBLE，并提供动画触发函数，供热键服务（peer）与托盘/命令（上层，向下调用）使用，
// 从而消除“服务/托盘回调 crate 根动画函数”的反向依赖（FR-006/FR-007，可见性单一所有者 FR-024 思路）。

use tauri::Emitter;

static IS_VISIBLE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

pub fn is_visible() -> bool {
    IS_VISIBLE.load(std::sync::atomic::Ordering::SeqCst)
}

pub fn set_visible(visible: bool) {
    IS_VISIBLE.store(visible, std::sync::atomic::Ordering::SeqCst);
}

pub fn trigger_hide_animation(window: &tauri::WebviewWindow) {
    let _ = window.emit(crate::application::events::FORCE_HIDE_ANIMATION, ());
    let win_clone = window.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(350)).await;
        let _ = win_clone.hide();
    });
}

pub fn trigger_show_animation(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus(); // 确保强制夺取焦点
    let _ = window.emit(crate::application::events::FORCE_SHOW_ANIMATION, ());
}

// 根据停靠方向应用窗口宽度与位置（DPI 换算逻辑从命令层下沉，命令仅做薄转发 FR-006）
pub fn apply_dock_width(
    window: &tauri::WebviewWindow,
    width: f64,
    is_left_dock: bool,
) -> Result<(), crate::services::error::ServiceError> {
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let current_physical_size = window.inner_size().unwrap_or_default();
    let current_logical_height = current_physical_size.height as f64 / scale_factor;

    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width,
            height: current_logical_height,
        }))
        .map_err(|e| crate::services::error::ServiceError::Internal(format!("set_size failed: {}", e)))?;

    if let Ok(Some(monitor)) = window.current_monitor() {
        let monitor_logical_size = monitor.size().to_logical::<f64>(scale_factor);

        let x_pos = if is_left_dock {
            0.0
        } else {
            monitor_logical_size.width - width
        };

        let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition {
            x: x_pos,
            y: 0.0,
        }));
    }

    Ok(())
}
