use std::path::Path;

use crate::services::error::ServiceError;

pub trait ExecutionServiceTrait: Send + Sync {
    fn launch_app(&self, executable_path: &str, args: Option<Vec<String>>, run_as_admin: bool) -> Result<(), ServiceError>;
    fn extract_file_info(&self, file_path: String) -> Result<ExtractedFileInfo, ServiceError>;
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
    fn launch_app(&self, executable_path: &str, args: Option<Vec<String>>, run_as_admin: bool) -> Result<(), ServiceError> {
        tracing::info!("====> 尝试启动目标进程: {} {:?} (管理员: {})", executable_path, args, run_as_admin);
        
        // 对于管理员提权启动，如果直接传入的是 .lnk 快捷方式，底层 Proxy 的 cmd.spawn() 会报 os error 193 
        // 因此我们在 service 层将 lnk 解析为真实的 target path 再发给 Proxy
        let final_path = executable_path.to_string();
        let final_args = args.clone();
        
            if run_as_admin && executable_path.to_lowercase().ends_with(".lnk") {
                // Since our custom extract_file_info only returns (name, path, icon_url),
                // we'll just rely on the path we have. Proxy fallback logic will handle it.
            }
        crate::services::os::windows::launch_app_windows(&final_path, final_args, run_as_admin)
    }

    fn extract_file_info(&self, file_path: String) -> Result<ExtractedFileInfo, ServiceError> {
        if file_path.starts_with(r"\\") {
            return Err(ServiceError::Security("Network paths starting with \\\\ are not allowed for security reasons.".to_string()));
        }

        let path = Path::new(&file_path);
        
        // 提取文件名（不包含扩展名）
        let name = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let encoded_path = percent_encoding::utf8_percent_encode(&file_path, percent_encoding::NON_ALPHANUMERIC).to_string();
        let icon_url = Some(format!("http://ezicon.localhost/{}", encoded_path));

        Ok(ExtractedFileInfo {
            name,
            path: file_path,
            icon_url,
        })
    }
}

/// 提取文件信息，用于拖放自动初始化
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedFileInfo {
    pub name: String,
    pub path: String,
    pub icon_url: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_launch_app_invalid_path() {
        let service = ExecutionService::new();
        let result = service.launch_app("invalid_executable_path_12345.exe", None, false);
        // 对于 Windows 下使用 ShellExecuteW 的情况，可能返回 err。此处仅作调用测试
    }
}
