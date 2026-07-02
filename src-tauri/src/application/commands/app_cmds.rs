use tauri::{command, State};
use crate::services::execution_service::{ExecutionServiceTrait, ExtractedFileInfo};
use crate::services::icon_service::IconServiceTrait;
use std::sync::Arc;
use crate::application::error::AppError;
use crate::services::os::windows::SystemApp;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use ts_rs::TS;

// 图标预取并发上限（FR-010）
static ICON_PREFETCH_SEM: std::sync::OnceLock<tokio::sync::Semaphore> = std::sync::OnceLock::new();

fn icon_prefetch_sem() -> &'static tokio::sync::Semaphore {
    ICON_PREFETCH_SEM.get_or_init(|| tokio::sync::Semaphore::new(16))
}

// GitHub Release 信息（仅保留前端所需字段）
#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, export_to = "../src/types/")]
pub struct ReleaseInfo {
    pub tag_name: String,
    pub name: Option<String>,
    pub html_url: String,
    pub body: Option<String>,
    pub published_at: String,
}

// release 检查内存缓存：避免未鉴权 60次/小时 限速被打满
struct ReleaseCache {
    cached_at: Option<Instant>,
    data: Option<ReleaseInfo>,
}

static RELEASE_CACHE: std::sync::OnceLock<Mutex<ReleaseCache>> = std::sync::OnceLock::new();

fn release_cache() -> &'static Mutex<ReleaseCache> {
    RELEASE_CACHE.get_or_init(|| Mutex::new(ReleaseCache { cached_at: None, data: None }))
}

const RELEASE_CACHE_TTL: Duration = Duration::from_secs(600);

// 查询 GitHub 最新 release；404=尚无 release，403=限速，均返回 Ok(None) 静默
// 阻塞 IO 放 spawn_blocking，避免阻塞 Tauri 异步运行时
fn fetch_latest_release(owner: &str, repo: &str) -> Result<Option<ReleaseInfo>, AppError> {
    let url = format!("https://api.github.com/repos/{owner}/{repo}/releases/latest");
    // GitHub API 强制要求 User-Agent，否则 403
    let resp = ureq::get(&url)
        .header("User-Agent", "ezLaunch")
        .header("Accept", "application/vnd.github+json")
        .call();

    let resp = match resp {
        Ok(r) => r,
        Err(ureq::Error::StatusCode(404)) => return Ok(None),
        Err(ureq::Error::StatusCode(403)) => return Ok(None),
        Err(e) => return Err(AppError::Other(format!("github api error: {e}"))),
    };

    let info: ReleaseInfo = resp.into_body().read_json()
        .map_err(|e| AppError::Other(format!("github api decode error: {e}")))?;
    Ok(Some(info))
}

#[command]
pub async fn check_latest_release(owner: String, repo: String) -> Result<Option<ReleaseInfo>, AppError> {
    // 缓存命中直接返回，节流限速
    {
        let cache = release_cache().lock().await;
        if let Some(cached_at) = cache.cached_at {
            if cached_at.elapsed() < RELEASE_CACHE_TTL {
                return Ok(cache.data.clone());
            }
        }
    }

    let owner_clone = owner.clone();
    let repo_clone = repo.clone();
    let data = tauri::async_runtime::spawn_blocking(move || {
        fetch_latest_release(&owner_clone, &repo_clone)
    })
    .await
    .map_err(|e| AppError::Other(format!("Thread join error: {}", e)))??;

    {
        let mut cache = release_cache().lock().await;
        cache.cached_at = Some(Instant::now());
        cache.data = data.clone();
    }
    Ok(data)
}

// 用默认浏览器打开 release 页面（复用已有 open crate）
#[command]
pub fn open_release_url(url: String) -> Result<(), AppError> {
    open::that(url).map_err(|e| AppError::Other(format!("open url error: {e}")))
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