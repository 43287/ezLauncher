use tauri::{command, State};
use crate::services::execution_service::{ExecutionServiceTrait, ExtractedFileInfo};
use std::sync::Arc;
use crate::application::error::AppError;
use crate::services::os::windows::SystemApp;

#[command]
pub async fn get_system_apps(
    execution_service: State<'_, Arc<dyn ExecutionServiceTrait>>
) -> Result<Vec<SystemApp>, AppError> {
    let service = execution_service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.get_system_apps()
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
    .map_err(|e| AppError::Other(e.to_string()))
    .map(|arc_apps| arc_apps.as_ref().clone())
}

#[command]
pub async fn launch_app(
    executable_path: String, 
    args: Option<Vec<String>>, 
    run_as_admin: Option<bool>,
    cwd: Option<String>,
    envs: Option<std::collections::HashMap<String, String>>,
    execution_service: State<'_, Arc<dyn ExecutionServiceTrait>>
) -> Result<(), AppError> {
    let service = execution_service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.launch_app(&executable_path, args, run_as_admin.unwrap_or(false), cwd, envs)
    })
    .await
    .map_err(|e| AppError::Other(e.to_string()))?
    .map_err(|e| AppError::Execution(e.to_string()))
}

#[command]
pub fn extract_file_info(
    file_path: String,
    execution_service: State<'_, Arc<dyn ExecutionServiceTrait>>
) -> Result<ExtractedFileInfo, AppError> {
    execution_service.extract_file_info(&file_path).map_err(|e| AppError::Other(e.to_string()))
}

#[command]
pub fn restart_as_admin(
    execution_service: State<'_, Arc<dyn ExecutionServiceTrait>>
) -> Result<(), AppError> {
    execution_service.relaunch_as_admin().map_err(|e| AppError::Other(e.to_string()))
}

#[command]
pub async fn update_window_width(
    width: f64,
    is_left_dock: bool,
    window: tauri::WebviewWindow,
) -> Result<(), AppError> {
    // 获取当前逻辑高度和显示器宽度
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let current_physical_size = window.inner_size().unwrap_or_default();
    let current_logical_height = current_physical_size.height as f64 / scale_factor;

    window.set_size(tauri::Size::Logical(tauri::LogicalSize {
        width,
        height: current_logical_height,
    })).map_err(AppError::Tauri)?;

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