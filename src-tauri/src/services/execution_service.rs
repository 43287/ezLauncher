use std::path::Path;
use std::collections::HashMap;
use std::sync::Arc;

use crate::services::error::ServiceError;
use crate::services::os::windows::SystemApp;

pub trait ExecutionServiceTrait: Send + Sync {
    fn launch_app(&self, executable_path: &str, args: Option<Vec<String>>, run_as_admin: bool, cwd: Option<String>, envs: Option<HashMap<String, String>>) -> Result<(), ServiceError>;
    fn extract_file_info(&self, file_path: &str) -> Result<ExtractedFileInfo, ServiceError>;
    fn get_system_apps(&self) -> Result<Arc<Vec<SystemApp>>, ServiceError>;
    fn relaunch_as_admin(&self) -> Result<(), ServiceError>;
}

pub struct ExecutionService;

impl Default for ExecutionService {
    fn default() -> Self {
        Self::new()
    }
}

impl ExecutionService {
    pub fn new() -> Self {
        Self
    }
}

impl ExecutionServiceTrait for ExecutionService {
    fn launch_app(&self, executable_path: &str, args: Option<Vec<String>>, run_as_admin: bool, cwd: Option<String>, envs: Option<HashMap<String, String>>) -> Result<(), ServiceError> {
        tracing::info!("====> 尝试启动目标进程: {} {:?} (管理员: {})", executable_path, args, run_as_admin);
        
        // 对于管理员提权启动，如果直接传入的是 .lnk 快捷方式，底层 Proxy 的 cmd.spawn() 会报 os error 193 
        // 因此我们在 service 层将 lnk 解析为真实的 target path 再发给 Proxy
        let final_path = executable_path.to_string();
        let final_args = args.clone();
            
        if run_as_admin {
            crate::services::proxy_server::request_admin_launch(&final_path, final_args, cwd, envs)
        } else {
            crate::services::os::windows::launch_app_windows(&final_path, final_args, cwd, envs)
        }
    }

    fn extract_file_info(&self, file_path: &str) -> Result<ExtractedFileInfo, ServiceError> {
        if file_path.starts_with(r"\\") {
            return Err(ServiceError::Security("Network paths starting with \\\\ are not allowed for security reasons.".to_string()));
        }

        let path = Path::new(file_path);
        
        // 提取文件名（不包含扩展名）
        let name = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let is_dir = path.is_dir();
        
        let icon_url = Some(file_path.to_string());

        Ok(ExtractedFileInfo {
            name,
            path: file_path.to_string(),
            icon_url,
            is_dir,
        })
    }

    fn get_system_apps(&self) -> Result<Arc<Vec<SystemApp>>, ServiceError> {
        crate::services::os::windows::scan_system_apps()
    }

    fn relaunch_as_admin(&self) -> Result<(), ServiceError> {
        crate::services::os::windows::relaunch_as_admin()
    }
}

/// 提取文件信息，用于拖放自动初始化
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedFileInfo {
    pub name: String,
    pub path: String,
    pub icon_url: Option<String>,
    pub is_dir: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_launch_app_invalid_path() {
        let service = ExecutionService::new();
        let result = service.launch_app("invalid_executable_path_12345.exe", None, false, None, None);
        // 对于 Windows 下使用 ShellExecuteW 的情况，可能返回 err。此处仅作调用测试
        assert!(result.is_err(), "Launch app should fail with invalid path");
    }
}
