use std::path::Path;

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

    pub fn launch_app(&self, executable_path: &str, args: Option<Vec<String>>, run_as_admin: bool) -> Result<(), String> {
        tracing::info!("====> 尝试启动目标进程: {} {:?} (管理员: {})", executable_path, args, run_as_admin);
        
        crate::services::os::windows::launch_app_windows(executable_path, args, run_as_admin)
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

pub fn extract_file_info(file_path: String) -> Result<ExtractedFileInfo, String> {
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
