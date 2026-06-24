use tauri::{command, State};
use crate::services::execution_service::{ExecutionServiceTrait, ExtractedFileInfo};
use crate::services::icon_service::IconServiceTrait;
use std::sync::Arc;
use crate::application::error::AppError;
use crate::services::os::windows::SystemApp;

// 图标预取并发上限（FR-010）
static ICON_PREFETCH_SEM: std::sync::OnceLock<tokio::sync::Semaphore> = std::sync::OnceLock::new();

fn icon_prefetch_sem() -> &'static tokio::sync::Semaphore {
    ICON_PREFETCH_SEM.get_or_init(|| tokio::sync::Semaphore::new(16))
}

#[command]
pub async fn get_system_apps(
    execution_service: State<'_, Arc<dyn ExecutionServiceTrait>>,
    icon_service: State<'_, Arc<dyn IconServiceTrait>>
) -> Result<Vec<SystemApp>, AppError> {
    let service = execution_service.inner().clone();
    let arc_apps = tauri::async_runtime::spawn_blocking(move || {
        service.get_system_apps()
    })
    .await
    .map_err(|e| AppError::Other(format!("Thread join error: {}", e)))?
    .map_err(AppError::from)?;

    let apps = arc_apps.as_ref().clone();

    // 预取图标以暖缓存（原在 scan_system_apps 内，移至命令层以使用注入的 IconService）
    // FR-010: Semaphore 限制并发数，防止数百个 spawn 同时执行
    let icon = icon_service.inner().clone();
    for app in &apps {
        let path = app.path.clone();
        let icon = icon.clone();
        tauri::async_runtime::spawn(async move {
            let _permit = icon_prefetch_sem().acquire().await;
            let _ = icon.get_icon_data(&path).await;
        });
    }

    Ok(apps)
}

#[command]
pub async fn launch_app(
    executable_path: String,
    args: Option<Vec<String>>,
    run_as_admin: Option<bool>,
    cwd: Option<String>,
    envs: Option<std::collections::HashMap<String, String>>,
    creation_flag: Option<u32>,
    execution_service: State<'_, Arc<dyn ExecutionServiceTrait>>
) -> Result<(), AppError> {
    let service = execution_service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.launch_app(&executable_path, args, run_as_admin.unwrap_or(false), cwd, envs, creation_flag)
    })
    .await
    .map_err(|e| AppError::Other(format!("Thread join error: {}", e)))?
    .map_err(AppError::from)?;
    Ok(())
}

#[command]
pub fn extract_file_info(
    file_path: String,
    execution_service: State<'_, Arc<dyn ExecutionServiceTrait>>
) -> Result<ExtractedFileInfo, AppError> {
    execution_service.extract_file_info(&file_path).map_err(AppError::from)
}

#[command]
pub fn restart_as_admin(
    execution_service: State<'_, Arc<dyn ExecutionServiceTrait>>
) -> Result<(), AppError> {
    Ok(execution_service.relaunch_as_admin()?)
}

#[command]
pub fn update_window_width(
    width: f64,
    is_left_dock: bool,
    window: tauri::WebviewWindow,
) -> Result<(), AppError> {
    // 窗口定位/DPI 换算逻辑下沉至 window_service，命令仅薄转发（FR-006）
    crate::services::window_service::apply_dock_width(&window, width, is_left_dock)?;
    Ok(())
}