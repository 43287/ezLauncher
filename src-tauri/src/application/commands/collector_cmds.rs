use tauri::command;
use crate::application::error::AppError;
use crate::domain::models::{ProcessInfo, ResolveResult};

// 009: 采集器后端命令（薄转发到 services/os/windows.rs）
// contracts/tauri-commands.md C1/C2

// 进程枚举与窗口解析为同步阻塞调用（系统快照/枚举），改用 spawn_blocking
// 卸载到阻塞线程池，避免阻塞 Tauri 的 IPC/异步运行时线程（FR-018 / P3-1）。
#[command]
pub async fn enumerate_processes() -> Result<Vec<ProcessInfo>, AppError> {
    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn_blocking(|| {
            crate::services::os::windows::enumerate_processes().map_err(AppError::from)
        })
        .await
        .map_err(|e| AppError::from(crate::services::error::ServiceError::Internal(
            format!("enumerate_processes join error: {}", e),
        )))?
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err(AppError::from(crate::services::error::ServiceError::Internal(
            "Process enumeration is only supported on Windows".to_string(),
        )))
    }
}

#[command]
pub async fn resolve_window_process_at_cursor() -> Result<ResolveResult, AppError> {
    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn_blocking(|| {
            crate::services::os::windows::resolve_window_process_at_cursor().map_err(AppError::from)
        })
        .await
        .map_err(|e| AppError::from(crate::services::error::ServiceError::Internal(
            format!("resolve_window_process_at_cursor join error: {}", e),
        )))?
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err(AppError::from(crate::services::error::ServiceError::Internal(
            "Window resolution is only supported on Windows".to_string(),
        )))
    }
}
