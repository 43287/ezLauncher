// 窗口可见性与显隐动画的协调者。
// 作为单一所有者持有 IS_VISIBLE，并提供动画触发函数，供热键服务（peer）与托盘/命令（上层，向下调用）使用，
// 从而消除“服务/托盘回调 crate 根动画函数”的反向依赖（FR-006/FR-007，可见性单一所有者 FR-024 思路）。

use tauri::Emitter;

static IS_VISIBLE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

// 停靠几何缓存：记录前端最近一次期望的“逻辑宽度 + 停靠侧”。
// 显示器/分辨率/DPI 变化后，几何需按当前显示器重算；缓存让每次“显示”都能自愈，
// 而无需依赖前端 React 副作用的时序（FR-006 定位逻辑单一所有者）。
static LAST_DOCK: std::sync::Mutex<Option<(f64, bool)>> = std::sync::Mutex::new(None);

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
    // 显示前先按“当前显示器”重算几何，避免沿用旧分辨率/旧显示器/旧 DPI。
    // 先于 show() 执行，因此不会出现“先以旧几何闪现、再跳到正确位置”的抖动。
    reapply_dock_geometry(window);
    let _ = window.show();
    let _ = window.set_focus(); // 确保强制夺取焦点
    let _ = window.emit(crate::application::events::FORCE_SHOW_ANIMATION, ());
}

// 根据停靠方向应用窗口宽度与位置（DPI 换算逻辑从命令层下沉，命令仅做薄转发 FR-006）。
// 同时缓存本次期望几何，供后续每次“显示”时基于当前显示器状态自愈重算。
pub fn apply_dock_width(
    window: &tauri::WebviewWindow,
    width: f64,
    is_left_dock: bool,
) -> Result<(), crate::services::error::ServiceError> {
    if let Ok(mut guard) = LAST_DOCK.lock() {
        *guard = Some((width, is_left_dock));
    }
    apply_dock_geometry(window, width, is_left_dock)
}

// 依据缓存的期望几何，在显示前基于“当前显示器”重算并应用，实现显示器/分辨率变化后的自愈。
// 缓存为空（尚未收到前端首次 update_window_width）时不做任何操作，交由前端首帧逻辑兜底。
pub fn reapply_dock_geometry(window: &tauri::WebviewWindow) {
    let cached = LAST_DOCK.lock().ok().and_then(|g| *g);
    if let Some((width, is_left_dock)) = cached {
        if let Err(e) = apply_dock_geometry(window, width, is_left_dock) {
            tracing::warn!("显示前重算停靠几何失败: {}", e);
        }
    }
}

// 稳健解析目标显示器：优先窗口当前所在显示器；若窗口已离屏（显示器被拔出/分辨率缩小），
// 依次回退到主显示器、任意可用显示器，避免定位被静默跳过而导致窗口卡在屏幕外。
fn resolve_target_monitor(window: &tauri::WebviewWindow) -> Option<tauri::Monitor> {
    if let Ok(Some(m)) = window.current_monitor() {
        return Some(m);
    }
    if let Ok(Some(m)) = window.primary_monitor() {
        return Some(m);
    }
    window
        .available_monitors()
        .ok()
        .and_then(|v| v.into_iter().next())
}

// 以物理像素为准，基于目标显示器“当前”的尺寸/原点/缩放重算并应用完整几何（宽度 + 全高 + 停靠位置）。
// 关键点：
//   1. 高度取显示器实时全高——修复沿用启动时旧高度导致的窗口过高/过矮。
//   2. 位置锚定 monitor.position()（物理原点）——修复多显示器下非零原点被忽略而定位到错误屏幕。
//   3. 缩放取 monitor.scale_factor() 而非窗口自身——规避跨不同 DPI 显示器时窗口 scale_factor 的滞后。
fn apply_dock_geometry(
    window: &tauri::WebviewWindow,
    logical_width: f64,
    is_left_dock: bool,
) -> Result<(), crate::services::error::ServiceError> {
    let monitor = resolve_target_monitor(window).ok_or_else(|| {
        crate::services::error::ServiceError::Internal("无可用显示器，无法定位窗口".to_string())
    })?;

    let scale = monitor.scale_factor();
    let mon_pos = monitor.position(); // 物理原点（虚拟桌面坐标）
    let mon_size = monitor.size(); // 物理尺寸

    let phys_width = ((logical_width * scale).round() as i32).max(1);
    let phys_height = (mon_size.height as i32).max(1);

    let x = if is_left_dock {
        mon_pos.x
    } else {
        mon_pos.x + mon_size.width as i32 - phys_width
    };
    let y = mon_pos.y;

    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: phys_width as u32,
            height: phys_height as u32,
        }))
        .map_err(|e| crate::services::error::ServiceError::Internal(format!("set_size failed: {}", e)))?;

    window
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
        .map_err(|e| crate::services::error::ServiceError::Internal(format!("set_position failed: {}", e)))?;

    Ok(())
}
